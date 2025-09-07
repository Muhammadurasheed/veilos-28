// Chat message cache for session persistence
interface CachedMessage {
  id: string;
  senderAlias: string;
  senderAvatarIndex: number;
  content: string;
  timestamp: string;
  type: 'text' | 'system' | 'emoji-reaction' | 'media';
  attachment?: any;
  replyTo?: string;
  replyToMessage?: {
    id: string;
    senderAlias: string;
    content: string;
    timestamp: string;
  };
}

interface MessageCache {
  sessionId: string;
  messages: CachedMessage[];
  lastUpdated: string;
}

class ChatMessageCacheManager {
  private readonly CACHE_KEY_PREFIX = 'chat_messages_';
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  getCacheKey(sessionId: string): string {
    return `${this.CACHE_KEY_PREFIX}${sessionId}`;
  }

  saveMessages(sessionId: string, messages: CachedMessage[]): void {
    try {
      const cache: MessageCache = {
        sessionId,
        messages,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.getCacheKey(sessionId), JSON.stringify(cache));
    } catch (error) {
      console.warn('Failed to cache messages:', error);
    }
  }

  loadMessages(sessionId: string): CachedMessage[] {
    try {
      const cacheData = localStorage.getItem(this.getCacheKey(sessionId));
      if (!cacheData) return [];

      const cache: MessageCache = JSON.parse(cacheData);
      
      // Check if cache is expired
      const cacheAge = Date.now() - new Date(cache.lastUpdated).getTime();
      if (cacheAge > this.CACHE_EXPIRY) {
        this.clearMessages(sessionId);
        return [];
      }

      return cache.messages || [];
    } catch (error) {
      console.warn('Failed to load cached messages:', error);
      return [];
    }
  }

  addMessage(sessionId: string, message: CachedMessage): void {
    const existingMessages = this.loadMessages(sessionId);
    const exists = existingMessages.find(m => m.id === message.id);
    
    if (!exists) {
      const updatedMessages = [...existingMessages, message];
      this.saveMessages(sessionId, updatedMessages);
    }
  }

  updateParticipantState(sessionId: string, participantId: string, state: { isMuted?: boolean; isKicked?: boolean }): void {
    try {
      const stateKey = `participant_state_${sessionId}_${participantId}`;
      const currentState = JSON.parse(localStorage.getItem(stateKey) || '{}');
      const updatedState = { ...currentState, ...state, lastUpdated: Date.now() };
      localStorage.setItem(stateKey, JSON.stringify(updatedState));
    } catch (error) {
      console.warn('Failed to cache participant state:', error);
    }
  }

  getParticipantState(sessionId: string, participantId: string): { isMuted?: boolean; isKicked?: boolean } {
    try {
      const stateKey = `participant_state_${sessionId}_${participantId}`;
      const state = localStorage.getItem(stateKey);
      if (!state) return {};
      
      const parsed = JSON.parse(state);
      const age = Date.now() - (parsed.lastUpdated || 0);
      
      // Expire after 1 hour
      if (age > 60 * 60 * 1000) {
        localStorage.removeItem(stateKey);
        return {};
      }
      
      return parsed;
    } catch (error) {
      console.warn('Failed to load participant state:', error);
      return {};
    }
  }

  clearMessages(sessionId: string): void {
    localStorage.removeItem(this.getCacheKey(sessionId));
  }

  clearAllCache(): void {
    Object.keys(localStorage)
      .filter(key => key.startsWith(this.CACHE_KEY_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  }
}

export const chatMessageCache = new ChatMessageCacheManager();
export type { CachedMessage };