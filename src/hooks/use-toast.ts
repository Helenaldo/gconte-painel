import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  try {
    console.debug('[useToast] Dispatching action:', action.type)
    memoryState = reducer(memoryState, action)
    
    // Guard against undefined listeners
    if (Array.isArray(listeners)) {
      listeners.forEach((listener) => {
        try {
          if (typeof listener === 'function') {
            listener(memoryState)
          }
        } catch (error) {
          console.error('[useToast] Error in listener:', error)
        }
      })
    }
  } catch (error) {
    console.error('[useToast] Error in dispatch:', error)
  }
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  try {
    console.debug('[useToast] Creating toast:', props)
    const id = genId()

    const update = (props: ToasterToast) => {
      try {
        dispatch({
          type: "UPDATE_TOAST",
          toast: { ...props, id },
        })
      } catch (error) {
        console.error('[useToast] Error updating toast:', error)
      }
    }
    
    const dismiss = () => {
      try {
        dispatch({ type: "DISMISS_TOAST", toastId: id })
      } catch (error) {
        console.error('[useToast] Error dismissing toast:', error)
      }
    }

    dispatch({
      type: "ADD_TOAST",
      toast: {
        ...props,
        id,
        open: true,
        onOpenChange: (open) => {
          if (!open) dismiss()
        },
      },
    })

    return {
      id: id,
      dismiss,
      update,
    }
  } catch (error) {
    console.error('[useToast] Error creating toast:', error)
    // Return a safe fallback
    return {
      id: 'error',
      dismiss: () => {},
      update: () => {},
    }
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    console.debug('[useToast] Initializing hook')
    
    const listener = (newState: State) => {
      try {
        if (newState && typeof newState === 'object') {
          setState(newState)
        }
      } catch (error) {
        console.error('[useToast] Error setting state:', error)
      }
    }
    
    // Guard against undefined listeners array
    if (Array.isArray(listeners)) {
      listeners.push(listener)
    }
    
    return () => {
      try {
        if (Array.isArray(listeners)) {
          const index = listeners.indexOf(listener)
          if (index > -1) {
            listeners.splice(index, 1)
          }
        }
      } catch (error) {
        console.error('[useToast] Error cleaning up listener:', error)
      }
    }
  }, [])

  const safeDismiss = (toastId?: string) => {
    try {
      dispatch({ type: "DISMISS_TOAST", toastId })
    } catch (error) {
      console.error('[useToast] Error dismissing:', error)
    }
  }

  return {
    ...state,
    toast,
    dismiss: safeDismiss,
  }
}

export { useToast, toast }