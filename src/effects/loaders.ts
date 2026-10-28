// Ánh xạ slug → component effect, nạp động để mỗi tác phẩm là một chunk riêng.
// Chỉ import từ component client.
import type { ComponentType } from "react";
import type { EffectProps } from "./types";

type Loader = () => Promise<{ default: ComponentType<EffectProps> }>;

export const EFFECT_LOADERS: Record<string, Loader> = {
  "mat-na-tinh-the": () => import("./mat-na-tinh-the/Effect"),
};
