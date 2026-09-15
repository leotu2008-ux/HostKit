import { describe, expect, it } from "vitest";
import { EmailSendError, classifyEmailFailure } from "@/lib/email/send";
import { messageForSendFailure, sendBlockedMessage, sendFailedMessage } from "@/lib/account";

/**
 * The bodies below are the shapes Resend actually answers with. The one that
 * matters most is the first: an unverified sending domain is Resend's default
 * state, so it is what a real deployment hits before anyone has finished
 * setting it up, and it has nothing to do with the address being signed up.
 */
const TESTING_ONLY =
  '{"statusCode":403,"message":"You can only send testing emails to your own email address (owner@example.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain."}';
const UNVERIFIED = '{"statusCode":403,"message":"The example.com domain is not verified. Please verify your domain."}';
const BAD_KEY = '{"statusCode":401,"message":"API key is invalid"}';
const BAD_ADDRESS = '{"statusCode":422,"message":"Invalid `to` field. Expected a valid email address."}';

describe("classifying why a send failed", () => {
  it("blames the server when the sending domain is unverified", () => {
    expect(classifyEmailFailure(403, TESTING_ONLY)).toBe("sender");
    expect(classifyEmailFailure(403, UNVERIFIED)).toBe("sender");
  });

  it("blames the server for a bad API key", () => {
    expect(classifyEmailFailure(401, BAD_KEY)).toBe("sender");
  });

  it("blames the address only when the address was rejected", () => {
    expect(classifyEmailFailure(422, BAD_ADDRESS)).toBe("recipient");
  });

  it("stays unknown for anything it cannot place", () => {
    expect(classifyEmailFailure(500, '{"message":"internal error"}')).toBe("unknown");
    expect(classifyEmailFailure(502, "")).toBe("unknown");
  });

  it("reads the cause off the thrown error", () => {
    expect(new EmailSendError(403, TESTING_ONLY).cause).toBe("sender");
    expect(new EmailSendError(422, BAD_ADDRESS).cause).toBe("recipient");
  });

  it("keeps the provider's own words on the error, truncated", () => {
    const error = new EmailSendError(403, TESTING_ONLY);
    expect(error.message).toContain("Resend 403");
    expect(error.message).toContain("verify a domain");
    expect(error.message.length).toBeLessThan(260);
  });
});

describe("what sign-up tells the person", () => {
  const email = "friend@cmu.edu";

  it("does not tell someone to check an address that is fine", () => {
    const message = messageForSendFailure(email, new EmailSendError(403, TESTING_ONLY));
    expect(message).toBe(sendBlockedMessage(email));
    expect(message).toContain("isn’t your address");
    expect(message).not.toContain("Check the address");
  });

  it("does tell them to check a genuinely bad address", () => {
    const message = messageForSendFailure(email, new EmailSendError(422, BAD_ADDRESS));
    expect(message).toBe(sendFailedMessage(email));
    expect(message).toContain("Check the address");
  });

  it("treats no answer at all as the server's problem", () => {
    expect(messageForSendFailure(email, new Error("fetch failed"))).toBe(sendBlockedMessage(email));
    expect(messageForSendFailure(email, undefined)).toBe(sendBlockedMessage(email));
  });

  it("names the address either way, because a typo is still common", () => {
    expect(sendBlockedMessage(email)).toContain(email);
    expect(sendFailedMessage(email)).toContain(email);
  });

  it("says the account was not kept, in both messages", () => {
    expect(sendBlockedMessage(email)).toContain("wasn’t created");
    expect(sendFailedMessage(email)).toContain("wasn’t created");
  });
});
