// Downtown Manhattan, cropped from NYC borough outlines (OGC:CRS84).
// The frame runs from just north of Houston Street to the Brooklyn Bridge,
// Hudson River to East River. It is not a five-borough map.
// Blocks are simplified — real street names, fewer of them — so the lines
// stay readable at this distance.

export const MAP_VIEW = { width: 1240, height: 920 } as const;

/** The lock point: Spring Street and Mercer Street, SoHo. */
export const MAP_FOCUS = { x: 586.4, y: 322.0 } as const;

/**
 * Block is a few SoHo blocks. Neighborhood is the downtown crop pulled back
 * just far enough to read the district, still close enough that the streets
 * stay visible.
 */
export const MAP_CAMERA = { block: 6.2, neighborhood: 1.48 } as const;

export const SCAN_BAND = { from: 178.5, to: 522.6 } as const;

export const ISLAND_PATH = "M1134.9 0.0 L1140.0 30.1 L1181.9 96.9 L1181.7 159.4 L1137.8 441.1 L1068.5 679.0 L970.4 735.2 L815.3 758.1 L806.5 730.5 L605.2 778.4 L537.9 832.6 L551.0 879.5 L532.5 897.9 L507.9 876.5 L510.9 904.3 L491.6 873.1 L499.2 901.4 L484.6 879.9 L464.1 900.7 L478.2 920.0 L474.3 920.0 L459.4 905.5 L447.7 916.4 L449.6 920.0 L181.2 920.0 L158.9 912.3 L184.7 904.6 L154.2 902.6 L144.3 857.8 L169.3 801.0 L154.9 793.6 L178.4 636.3 L203.3 658.5 L209.8 617.5 L183.3 610.8 L179.4 628.6 L201.4 446.1 L277.2 456.2 L280.3 436.3 L283.7 410.4 L248.8 383.4 L282.6 390.1 L311.0 207.9 L234.0 191.8 L235.8 177.6 L313.4 189.0 L316.9 130.5 L251.7 122.8 L259.3 49.5 L321.7 57.5 L324.9 0.0 Z";

export const BROOKLYN_PATH = "M1240.0 920.0 L679.1 920.0 L681.4 914.2 L734.3 903.9 L753.4 920.0 L762.8 920.0 L775.5 895.9 L817.2 908.8 L824.7 889.3 L977.1 881.6 L977.5 863.9 L1025.7 878.8 L1033.1 860.9 L1044.7 920.0 L1073.3 920.0 L1084.8 903.1 L1079.1 920.0 L1166.3 920.0 L1113.1 858.4 L1158.7 854.1 L1113.6 805.6 L1190.2 865.8 L1163.7 759.6 L1208.3 831.7 L1210.1 896.0 L1235.7 920.0 L1240.0 920.0 L1240.0 907.8 L1229.2 890.8 L1213.8 714.5 L1240.0 619.8 Z";

export const BLOCKS = [
  { x: 289.3, y: 123.4, w: 54.0, h: 87.6 },
  { x: 289.3, y: 226.0, w: 54.0, h: 61.3 },
  { x: 289.3, y: 294.3, w: 54.0, h: 32.4 },
  { x: 289.3, y: 333.7, w: 54.0, h: 81.7 },
  { x: 289.3, y: 422.4, w: 54.0, h: 36.6 },
  { x: 289.3, y: 474.1, w: 54.0, h: 90.9 },
  { x: 289.3, y: 571.9, w: 54.0, h: 36.6 },
  { x: 289.3, y: 623.6, w: 54.0, h: 33.4 },
  { x: 350.4, y: 123.4, w: 38.5, h: 87.6 },
  { x: 350.4, y: 226.0, w: 38.5, h: 61.3 },
  { x: 350.4, y: 294.3, w: 38.5, h: 32.4 },
  { x: 350.4, y: 333.7, w: 38.5, h: 81.7 },
  { x: 350.4, y: 422.4, w: 38.5, h: 36.6 },
  { x: 350.4, y: 474.1, w: 38.5, h: 90.9 },
  { x: 350.4, y: 571.9, w: 38.5, h: 36.6 },
  { x: 350.4, y: 623.6, w: 38.5, h: 33.4 },
  { x: 395.9, y: 123.4, w: 49.4, h: 87.6 },
  { x: 395.9, y: 226.0, w: 49.4, h: 61.3 },
  { x: 395.9, y: 294.3, w: 49.4, h: 32.4 },
  { x: 395.9, y: 333.7, w: 49.4, h: 81.7 },
  { x: 395.9, y: 422.4, w: 49.4, h: 36.6 },
  { x: 395.9, y: 474.1, w: 49.4, h: 90.9 },
  { x: 395.9, y: 571.9, w: 49.4, h: 36.6 },
  { x: 395.9, y: 623.6, w: 49.4, h: 33.4 },
  { x: 452.2, y: 123.4, w: 47.2, h: 87.6 },
  { x: 452.2, y: 226.0, w: 47.2, h: 61.3 },
  { x: 452.2, y: 294.3, w: 47.2, h: 32.4 },
  { x: 452.2, y: 333.7, w: 47.2, h: 81.7 },
  { x: 452.2, y: 422.4, w: 47.2, h: 36.6 },
  { x: 452.2, y: 474.1, w: 47.2, h: 90.9 },
  { x: 452.2, y: 571.9, w: 47.2, h: 36.6 },
  { x: 452.2, y: 623.6, w: 47.2, h: 33.4 },
  { x: 506.4, y: 123.4, w: 38.5, h: 87.6 },
  { x: 506.4, y: 226.0, w: 38.5, h: 61.3 },
  { x: 506.4, y: 294.3, w: 38.5, h: 32.4 },
  { x: 506.4, y: 333.7, w: 38.5, h: 81.7 },
  { x: 506.4, y: 422.4, w: 38.5, h: 36.6 },
  { x: 506.4, y: 474.1, w: 38.5, h: 90.9 },
  { x: 506.4, y: 571.9, w: 38.5, h: 36.6 },
  { x: 506.4, y: 623.6, w: 38.5, h: 33.4 },
  { x: 552.0, y: 123.4, w: 60.2, h: 87.6 },
  { x: 552.0, y: 226.0, w: 60.2, h: 61.3 },
  { x: 552.0, y: 294.3, w: 60.2, h: 32.4 },
  { x: 552.0, y: 333.7, w: 60.2, h: 81.7 },
  { x: 552.0, y: 422.4, w: 60.2, h: 36.6 },
  { x: 552.0, y: 474.1, w: 60.2, h: 90.9 },
  { x: 552.0, y: 571.9, w: 60.2, h: 36.6 },
  { x: 552.0, y: 623.6, w: 60.2, h: 33.4 },
  { x: 619.2, y: 123.4, w: 40.7, h: 87.6 },
  { x: 619.2, y: 226.0, w: 40.7, h: 61.3 },
  { x: 619.2, y: 294.3, w: 40.7, h: 32.4 },
  { x: 619.2, y: 333.7, w: 40.7, h: 81.7 },
  { x: 619.2, y: 422.4, w: 40.7, h: 36.6 },
  { x: 619.2, y: 474.1, w: 40.7, h: 90.9 },
  { x: 619.2, y: 571.9, w: 40.7, h: 36.6 },
  { x: 619.2, y: 623.6, w: 40.7, h: 33.4 },
  { x: 666.9, y: 123.4, w: 67.0, h: 87.6 },
  { x: 666.9, y: 226.0, w: 67.0, h: 61.3 },
  { x: 666.9, y: 294.3, w: 67.0, h: 32.4 },
  { x: 666.9, y: 333.7, w: 67.0, h: 81.7 },
  { x: 666.9, y: 422.4, w: 67.0, h: 36.6 },
  { x: 666.9, y: 474.1, w: 67.0, h: 90.9 },
  { x: 666.9, y: 571.9, w: 67.0, h: 36.6 },
  { x: 666.9, y: 623.6, w: 67.0, h: 33.4 },
  { x: 748.9, y: 123.4, w: 58.4, h: 87.6 },
  { x: 748.9, y: 226.0, w: 58.4, h: 61.3 },
  { x: 748.9, y: 294.3, w: 58.4, h: 32.4 },
  { x: 748.9, y: 333.7, w: 58.4, h: 81.7 },
  { x: 748.9, y: 422.4, w: 58.4, h: 36.6 },
  { x: 748.9, y: 474.1, w: 58.4, h: 90.9 },
  { x: 748.9, y: 571.9, w: 58.4, h: 36.6 },
  { x: 748.9, y: 623.6, w: 58.4, h: 33.4 },
  { x: 814.3, y: 123.4, w: 71.0, h: 87.6 },
  { x: 814.3, y: 226.0, w: 71.0, h: 61.3 },
  { x: 814.3, y: 294.3, w: 71.0, h: 32.4 },
  { x: 814.3, y: 333.7, w: 71.0, h: 81.7 },
  { x: 814.3, y: 422.4, w: 71.0, h: 36.6 },
  { x: 814.3, y: 474.1, w: 71.0, h: 90.9 },
  { x: 814.3, y: 571.9, w: 71.0, h: 36.6 },
  { x: 814.3, y: 623.6, w: 71.0, h: 33.4 },
  { x: 892.3, y: 123.4, w: 45.0, h: 87.6 },
  { x: 892.3, y: 226.0, w: 45.0, h: 61.3 },
  { x: 892.3, y: 294.3, w: 45.0, h: 32.4 },
  { x: 892.3, y: 333.7, w: 45.0, h: 81.7 },
  { x: 892.3, y: 422.4, w: 45.0, h: 36.6 },
  { x: 892.3, y: 474.1, w: 45.0, h: 90.9 },
  { x: 892.3, y: 571.9, w: 45.0, h: 36.6 },
  { x: 892.3, y: 623.6, w: 45.0, h: 33.4 },
] as const;

export const PARKS = [
  { name: "Washington Square", x: 534.4, y: 11.5, w: 97.6, h: 59.1 },
  { name: "City Hall Park", x: 400.0, y: 601.3, w: 72.6, h: 77.2 },
  { name: "Columbus Park", x: 530.0, y: 514.2, w: 49.9, h: 55.9 },
] as const;

export const BROADWAY_PATH = "M641.7 0.0 L639.5 118.3 L635.2 218.5 L609.2 330.2 L572.3 418.9 L526.8 525.7 L470.4 616.1 L416.2 716.3 L364.2 834.6 L325.2 913.4";

export const BRIDGES = [
  { name: "Brooklyn Bridge", x1: 463.9, y1: 852.6, x2: 702.4, y2: 865.8 },
  { name: "Manhattan Bridge", x1: 767.4, y1: 809.9, x2: 927.8, y2: 823.1 },
  { name: "Williamsburg Bridge", x1: 1079.6, y1: 609.5, x2: 1222.7, y2: 593.1 },
] as const;

export const VENUES = [
  { id: "v-mercer", name: "Mercer Loft", detail: "Gallery · 120 standing", x: 612.4, y: 285.9 },
  { id: "v-spring", name: "Spring Room", detail: "Loft · 80 seated", x: 558.2, y: 328.6 },
  { id: "v-canal", name: "Canal Hall", detail: "Hall · 200 standing", x: 505.1, y: 461.6 },
  { id: "v-hudson", name: "Hudson Rooms", detail: "Riverside · 90 seated", x: 359.9, y: 382.8 },
] as const;

export const NEIGHBORHOOD_LABELS = [
  { text: "SOHO", x: 555.0, y: 267.8 },
  { text: "TRIBECA", x: 355.5, y: 542.1 },
  { text: "CHINATOWN", x: 650.3, y: 535.6 },
  { text: "NOLITA", x: 685.0, y: 274.4 },
] as const;

export const STREET_LABELS = [
  { text: "HOUSTON ST", x: 420, y: 208.5 },
  { text: "CANAL ST", x: 420, y: 456.6 },
  { text: "CHAMBERS ST", x: 430, y: 606.1 },
  { text: "BROADWAY", x: 640, y: 372 },
  { text: "WEST ST", x: 318, y: 250 },
  { text: "BOWERY", x: 748, y: 300 },
] as const;

/** Centerlines of the simplified grid. Drawn on top of the blocks so the streets stay visible. */
export const AVENUES = [
  { name: "West St", x: 281.8, major: true },
  { name: "Greenwich St", x: 346.9, major: false },
  { name: "Hudson St", x: 392.4, major: false },
  { name: "Varick St", x: 448.7, major: false },
  { name: "6th Ave", x: 502.9, major: false },
  { name: "W Broadway", x: 548.5, major: false },
  { name: "Mercer St", x: 615.7, major: false },
  { name: "Lafayette St", x: 663.4, major: false },
  { name: "Bowery", x: 741.4, major: true },
  { name: "Allen St", x: 810.8, major: false },
  { name: "Essex St", x: 888.8, major: false },
  { name: "Clinton St", x: 940.8, major: false },
] as const;

export const CROSS_STREETS = [
  { name: "Bleecker St", y: 119.9, major: false },
  { name: "Houston St", y: 218.5, major: true },
  { name: "Prince St", y: 290.8, major: false },
  { name: "Spring St", y: 330.2, major: false },
  { name: "Grand St", y: 418.9, major: false },
  { name: "Canal St", y: 466.6, major: true },
  { name: "Franklin St", y: 568.4, major: false },
  { name: "Chambers St", y: 616.1, major: true },
  { name: "Reade St", y: 660.4, major: false },
] as const;

export const WATER_LABELS = [
  { text: "HUDSON RIVER", x: 232.3, y: 390, rotate: -90 },
  { text: "EAST RIVER", x: 1156.0, y: 560, rotate: 90 },
] as const;

