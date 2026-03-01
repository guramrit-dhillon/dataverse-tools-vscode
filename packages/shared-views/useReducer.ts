import { useReducer as useDefaultReducer, useEffect, useCallback } from "react";
import vscode from "./vscode";

type Action<T, P> = { type: T; payload?: P; meta?: { toExtension?: boolean } };
type Reducer<S, A extends Action<any, any>> = (state: S, action: A) => S;


export default function useReducer<S, A extends Action<any, any>>(
  reducer: Reducer<S, A>,
  initialState: S
): [S, (action: A) => void] {
  const [state, dispatch] = useDefaultReducer(reducer, initialState);

  // Listen to messages from extension → dispatch to reducer
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const action = event.data as A;
      if (!action?.type) { return; } // ignore malformed messages
      dispatch(action);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [dispatch]);

  // Custom dispatch that optionally posts to extension
  const customDispatch = useCallback(
    (action: A) => {
      // Send to extension if flagged
      if (action.meta?.toExtension && vscode?.postMessage) {
        vscode.postMessage(action);
      }
      // Always update local state
      dispatch(action);
    },
    [dispatch]
  );

  return [state, customDispatch];
}
