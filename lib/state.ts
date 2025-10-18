/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { itineraryPlannerTools } from './tools/itinerary-planner';

export type Template = 'itinerary-planner';

const toolsets: Record<Template, FunctionCall[]> = {
  'itinerary-planner': itineraryPlannerTools,
};

import {
  SYSTEM_INSTRUCTIONS,
  SCAVENGER_HUNT_PROMPT,
} from './constants.ts';
const systemPrompts: Record<Template, string> = {
  'itinerary-planner': SYSTEM_INSTRUCTIONS,
};

import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  GenerateContentResponse,
  FunctionResponse,
  FunctionResponseScheduling,
  LiveServerToolCall,
  GroundingChunk,
} from '@google/genai';
import { Map3DCameraProps } from '@/components/map-3d';

/**
 * Personas
 */
export const SCAVENGER_HUNT_PERSONA =
  'ClueMaster Cory, the Scavenger Hunt Creator';

export const personas: Record<string, { prompt: string; voice: string }> = {
  [SCAVENGER_HUNT_PERSONA]: {
    prompt: SCAVENGER_HUNT_PROMPT,
    voice: 'Puck',
  },
};

/**
 * Settings
 */
export const useSettings = create<{
  systemPrompt: string;
  model: string;
  voice: string;
  isEasterEggMode: boolean;
  activePersona: string;
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
  setPersona: (persona: string) => void;
  activateEasterEggMode: () => void;
}>(set => ({
  systemPrompt: systemPrompts['itinerary-planner'],
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  isEasterEggMode: false,
  activePersona: SCAVENGER_HUNT_PERSONA,
  setSystemPrompt: prompt => set({ systemPrompt: prompt }),
  setModel: model => set({ model }),
  setVoice: voice => set({ voice }),
  setPersona: (persona: string) => {
    if (personas[persona]) {
      set({
        activePersona: persona,
        systemPrompt: personas[persona].prompt,
        voice: personas[persona].voice,
      });
    }
  },
  activateEasterEggMode: () => {
    set(state => {
      if (!state.isEasterEggMode) {
        // Unlock the Explorer badge when activating easter egg mode.
        useBadgeStore.getState().unlockBadge('Explorer');
        const persona = SCAVENGER_HUNT_PERSONA;
        return {
          isEasterEggMode: true,
          activePersona: persona,
          systemPrompt: personas[persona].prompt,
          voice: personas[persona].voice,
          model: 'gemini-live-2.5-flash-preview', // gemini-2.5-flash-preview-native-audio-dialog
        };
      }
      return {};
    });
  },
}));

/**
 * UI
 */
export const useUI = create<{
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  showSystemMessages: boolean;
  toggleShowSystemMessages: () => void;
  toastMessage: string | null;
  showToast: (message: string) => void;
  hideToast: () => void;
}>(set => ({
  isSidebarOpen: false,
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  showSystemMessages: false,
  toggleShowSystemMessages: () =>
    set(state => ({ showSystemMessages: !state.showSystemMessages })),
  toastMessage: null,
  showToast: message => set({ toastMessage: message }),
  hideToast: () => set({ toastMessage: null }),
}));

/**
 * Tools
 */
export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}



export const useTools = create<{
  tools: FunctionCall[];
  template: Template;
  setTemplate: (template: Template) => void;
}>(set => ({
  tools: itineraryPlannerTools,
  template: 'itinerary-planner',
  setTemplate: (template: Template) => {
    set({ tools: toolsets[template], template });
    useSettings.getState().setSystemPrompt(systemPrompts[template]);
  },
}));

/**
 * Logs
 */
export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}

export interface ConversationTurn {
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: LiveClientToolResponse;
  groundingChunks?: GroundingChunk[];
  toolResponse?: GenerateContentResponse;
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  isAwaitingFunctionResponse: boolean;
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  mergeIntoLastAgentTurn: (
    update: Omit<ConversationTurn, 'timestamp' | 'role'>,
  ) => void;
  clearTurns: () => void;
  setIsAwaitingFunctionResponse: (isAwaiting: boolean) => void;
}>((set, get) => ({
  turns: [],
  isAwaitingFunctionResponse: false,
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: (update: Partial<Omit<ConversationTurn, 'timestamp'>>) => {
    set(state => {
      if (state.turns.length === 0) {
        return state;
      }
      const newTurns = [...state.turns];
      const lastTurn = { ...newTurns[newTurns.length - 1], ...update };
      newTurns[newTurns.length - 1] = lastTurn;
      return { turns: newTurns };
    });
  },
  mergeIntoLastAgentTurn: (
    update: Omit<ConversationTurn, 'timestamp' | 'role'>,
  ) => {
    set(state => {
      const turns = state.turns;
      const lastAgentTurnIndex = turns.map(t => t.role).lastIndexOf('agent');

      if (lastAgentTurnIndex === -1) {
        // Fallback: add a new turn.
        return {
          turns: [
            ...turns,
            { ...update, role: 'agent', timestamp: new Date() } as ConversationTurn,
          ],
        };
      }

      const lastAgentTurn = turns[lastAgentTurnIndex];
      const mergedTurn: ConversationTurn = {
        ...lastAgentTurn,
        text: lastAgentTurn.text + (update.text || ''),
        isFinal: update.isFinal,
        groundingChunks: [
          ...(lastAgentTurn.groundingChunks || []),
          ...(update.groundingChunks || []),
        ],
        toolResponse: update.toolResponse || lastAgentTurn.toolResponse,
      };

      // Rebuild the turns array, replacing the old agent turn.
      const newTurns = [...turns];
      newTurns[lastAgentTurnIndex] = mergedTurn;


      return { turns: newTurns };
    });
  },
  clearTurns: () => set({ turns: [] }),
  setIsAwaitingFunctionResponse: isAwaiting =>
    set({ isAwaitingFunctionResponse: isAwaiting }),
}));

/**
 * Map Entities
 */
export interface MapMarker {
  position: {
    lat: number;
    lng: number;
    altitude: number;
  };
  label: string;
  showLabel: boolean;
}

export const useMapStore = create<{
  markers: MapMarker[];
  cameraTarget: Map3DCameraProps | null;
  preventAutoFrame: boolean;
  setMarkers: (markers: MapMarker[]) => void;
  clearMarkers: () => void;
  setCameraTarget: (target: Map3DCameraProps | null) => void;
  setPreventAutoFrame: (prevent: boolean) => void;
}>(set => ({
  markers: [],
  cameraTarget: null,
  preventAutoFrame: false,
  setMarkers: markers => set({ markers }),
  clearMarkers: () => set({ markers: [] }),
  setCameraTarget: target => set({ cameraTarget: target }),
  setPreventAutoFrame: prevent => set({ preventAutoFrame: prevent }),
}));

/**
 * Badges
 */
export type BadgeName = 'Welcome' | 'Communicator' | 'Planner' | 'Explorer';

export interface Badge {
  name: BadgeName;
  description: string;
  icon: string;
  unlocked: boolean;
}

export const allBadges: Record<BadgeName, Omit<Badge, 'unlocked'>> = {
  'Welcome': { name: 'Welcome', description: 'Joined the session', icon: 'door_open' },
  'Communicator': { name: 'Communicator', description: 'Used voice input', icon: 'mic' },
  'Planner': { name: 'Planner', description: 'Planned a full itinerary', icon: 'edit_calendar' },
  'Explorer': { name: 'Explorer', description: 'Found the easter egg', icon: 'egg' },
};

export const useBadgeStore = create<{
  badges: Record<BadgeName, Badge>;
  itineraryProgress: { city: boolean; restaurant: boolean; activity: boolean };
  unlockBadge: (name: BadgeName) => void;
  setItineraryProgress: (
    progress: Partial<
      typeof useBadgeStore.getState['itineraryProgress']
    >,
  ) => void;
}>((set, get) => ({
  badges: {
    'Welcome': { ...allBadges['Welcome'], unlocked: false },
    'Communicator': { ...allBadges['Communicator'], unlocked: false },
    'Planner': { ...allBadges['Planner'], unlocked: false },
    'Explorer': { ...allBadges['Explorer'], unlocked: false },
  },
  itineraryProgress: { city: false, restaurant: false, activity: false },
  unlockBadge: (name: BadgeName) => {
    const { badges } = get();
    if (!badges[name].unlocked) {
      set(state => ({
        badges: {
          ...state.badges,
          [name]: { ...state.badges[name], unlocked: true },
        },
      }));
      useUI.getState().showToast(`Badge Unlocked: ${name}`);
    }
  },
  setItineraryProgress: progress => {
    set(state => ({
      itineraryProgress: { ...state.itineraryProgress, ...progress },
    }));
    const { itineraryProgress } = get();
    if (
      itineraryProgress.city &&
      itineraryProgress.restaurant &&
      itineraryProgress.activity
    ) {
      get().unlockBadge('Planner');
      // Reset progress after unlocking
      set({
        itineraryProgress: { city: false, restaurant: false, activity: false },
      });
    }
  },
}));