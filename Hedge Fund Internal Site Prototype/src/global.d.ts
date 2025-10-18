interface JainSnakeAPI {
  init?: (opts?: { sound?: boolean }) => void;
  destroy?: () => void;
}

interface Window {
  JainSnake?: JainSnakeAPI;
}

export {};

// Provide a permissive JSX IntrinsicElements mapping so TSX in this repo compiles
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
