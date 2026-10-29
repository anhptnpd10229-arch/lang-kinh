// Ánh xạ slug → module effect, nạp động để mỗi tác phẩm là một chunk riêng.
// Chỉ import từ component client.
import type { EffectModule } from "./types";

type Loader = () => Promise<EffectModule>;

export const EFFECT_LOADERS: Record<string, Loader> = {
  "net-ve-khong-trung": () => import("./net-ve-khong-trung/Effect"),
  "tiem-giat": () => import("./tiem-giat/Effect"),
  aether: () => import("./aether/Effect"),
};
