// Kênh nối giữa phần effect chạy trong Canvas R3F và lớp giao diện DOM của chính effect đó
// (hai cây React khác renderer nên không dùng chung state React được).
// - Effect ghi trạng thái hiển thị bằng `set` (chỉ khi thay đổi, không ghi mỗi khung hình).
// - Giao diện đọc bằng useSyncExternalStore(bus.subscribe, bus.get) và gửi lệnh bằng `send`.

type Listener = () => void;
type CommandHandler = (command: string) => void;

export class EffectBus {
  private state: Readonly<Record<string, unknown>> = {};
  private listeners = new Set<Listener>();
  private handlers = new Set<CommandHandler>();

  get = () => this.state;

  set(patch: Record<string, unknown>) {
    if (Object.keys(patch).every((k) => Object.is(this.state[k], patch[k]))) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  send(command: string) {
    this.handlers.forEach((h) => h(command));
  }

  onCommand(handler: CommandHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}
