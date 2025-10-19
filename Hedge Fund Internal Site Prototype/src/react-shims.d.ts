/** Minimal React shims for this prototype workspace.
 * This avoids adding @types/react as a dependency while keeping TSX files functional.
 * It's intentionally permissive.
 */
declare module 'react' {
	type DependencyList = any[];
	export function useState<S>(initialState: S | (() => S)) : [S, (v: S | ((prev: S) => S)) => void];
	export function useEffect(effect: () => void | (() => void), deps?: DependencyList): void;
	export function useRef<T>(initial?: T | null): { current: T | null };
	export function useCallback<T extends (...args: any[]) => any>(fn: T, deps?: DependencyList): T;
	export function useMemo<T>(fn: () => T, deps?: DependencyList): T;
	export const Fragment: any;
	export default any;
}

declare module 'react/jsx-runtime' {
	export const jsx: any;
	export const jsxs: any;
	export const Fragment: any;
}

declare global {
	namespace JSX {
		interface IntrinsicElements {
			[elemName: string]: any;
		}
	}
}

export {};
