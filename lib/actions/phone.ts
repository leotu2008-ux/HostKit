"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/session";
import {
  PhoneError,
  confirmPhoneVerification,
  removePhone,
  startPhoneVerification,
} from "@/lib/phone";

export type PhoneFormState =
  | { step: "number"; error?: string }
  | { step: "code"; phone: string; devCode?: string; error?: string; sent?: boolean }
  | { step: "done" }
  | undefined;

/** One action, three intents (start / verify / remove), so the form keeps one state. */
export async function phoneAction(prev: PhoneFormState, formData: FormData): Promise<PhoneFormState> {
  const user = await requireUser("/settings");
  const intent = String(formData.get("intent") ?? "start");
  try {
    if (intent === "remove") {
      await removePhone(user.id);
      refresh();
      return { step: "number" };
    }
    if (intent === "verify") {
      await confirmPhoneVerification(user.id, String(formData.get("code") ?? ""));
      refresh();
      return { step: "done" };
    }
    const started = await startPhoneVerification(user.id, String(formData.get("phone") ?? ""));
    return { step: "code", phone: started.phone, devCode: started.devCode, sent: true };
  } catch (error) {
    if (error instanceof PhoneError) {
      if (intent === "verify" && prev?.step === "code") return { ...prev, sent: false, error: error.message };
      return { step: "number", error: error.message };
    }
    throw error;
  }
}
