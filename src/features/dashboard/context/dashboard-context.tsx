'use client';

import { createContext, useContext, useReducer, type ReactNode } from 'react';

interface DashboardState {
  currentPage: number;
  pageSize: number;
  isUpgradeModalOpen: boolean;
}

type DashboardAction =
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'OPEN_UPGRADE_MODAL' }
  | { type: 'CLOSE_UPGRADE_MODAL' }
  | { type: 'RESET_PAGINATION' };

const initialState: DashboardState = {
  currentPage: 1,
  pageSize: 10,
  isUpgradeModalOpen: false,
};

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };
    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.payload, currentPage: 1 };
    case 'OPEN_UPGRADE_MODAL':
      return { ...state, isUpgradeModalOpen: true };
    case 'CLOSE_UPGRADE_MODAL':
      return { ...state, isUpgradeModalOpen: false };
    case 'RESET_PAGINATION':
      return { ...state, currentPage: 1 };
    default:
      return state;
  }
}

interface DashboardContextValue {
  state: DashboardState;
  dispatch: React.Dispatch<DashboardAction>;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  return (
    <DashboardContext.Provider value={{ state, dispatch }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
}
