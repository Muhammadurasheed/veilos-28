import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, ChevronUp, Shield, AtSign, Paperclip, Reply, Maximize2, Minimize2, GripVertical } from 'lucide-react';
import { MediaPreviewModal } from './MediaPreviewModal';
import { chatMessageCache, type CachedMessage } from './ChatMessageCache';
import type { LiveParticipant } from '@/types/sanctuary';

interface ChatMessage {
  id: string;
  senderAlias: string;
  senderAvatarIndex: number;
  content: string;
  timestamp: Date;
  type: 'text' | 'system' | 'emoji-reaction' | 'media';
  mentions?: string[];
  attachment?: any;
  replyTo?: string;
  replyToMessage?: {
    id: string;
    senderAlias: string;
    content: string;
    timestamp: string;
  };
}

interface ResizableChatPanelProps {
  isVisible: boolean;
  onToggle: () => void;
  messages: ChatMessage[];
  participants: LiveParticipant[];
  currentUserAlias: string;
  sessionId: string;
  onSendMessage: (content: string, type?: 'text' | 'emoji-reaction' | 'media', attachment?: any, replyTo?: string) => void;
}

export const ResizableChatPanel = ({
  isVisible,
  onToggle,
  messages,
  participants,
  currentUserAlias,
  sessionId,
  onSendMessage
}: ResizableChatPanelProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [chatWidth, setChatWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enhanced messages with cached reply chains
  const [enhancedMessages, setEnhancedMessages] = useState<ChatMessage[]>([]);

  // Load cached messages and enhance with reply chains
  useEffect(() => {
    const cachedMessages = chatMessageCache.loadMessages(sessionId);
    const messageMap = new Map<string, ChatMessage>();
    
    // Convert cached messages to chat messages
    const allMessages = [...messages];
    cachedMessages.forEach(cached => {
      if (!allMessages.find(m => m.id === cached.id)) {
        allMessages.push({
          ...cached,
          timestamp: new Date(cached.timestamp)
        });
      }
    });

    // Build message map for reply lookups
    allMessages.forEach(msg => messageMap.set(msg.id, msg));

    // Enhance messages with reply chain data
    const enhanced = allMessages.map(msg => {
      if (msg.replyTo && messageMap.has(msg.replyTo)) {
        const replyToMsg = messageMap.get(msg.replyTo)!;
        return {
          ...msg,
          replyToMessage: {
            id: replyToMsg.id,
            senderAlias: replyToMsg.senderAlias,
            content: replyToMsg.content,
            timestamp: replyToMsg.timestamp.toISOString()
          }
        };
      }
      return msg;
    });

    setEnhancedMessages(enhanced.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()));
  }, [messages, sessionId]);

  // Cache new messages with reply chain data
  useEffect(() => {
    enhancedMessages.forEach(msg => {
      chatMessageCache.addMessage(sessionId, {
        ...msg,
        timestamp: msg.timestamp.toISOString()
      });
    });
  }, [enhancedMessages, sessionId]);

  // Resize functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = Math.max(300, Math.min(800, window.innerWidth - e.clientX));
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [enhancedMessages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() && !selectedFile) return;

    let content = newMessage;
    let attachment = null;

    if (selectedFile) {
      const formData = new FormData();
      formData.append('media', selectedFile);
      attachment = formData;
      content = selectedFile.name;
    }

    onSendMessage(
      content,
      selectedFile ? 'media' : 'text',
      attachment,
      replyingTo?.id
    );

    setNewMessage('');
    setSelectedFile(null);
    setReplyingTo(null);
    setShowMediaPreview(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowMediaPreview(true);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isSystemMessage = message.type === 'system';
    const isEmojiReaction = message.type === 'emoji-reaction';
    const isMediaMessage = message.type === 'media';

    if (isSystemMessage) {
      return (
        <div key={message.id} className="flex justify-center my-2">
          <Badge variant="secondary" className="text-xs px-2 py-1">
            {message.content}
          </Badge>
        </div>
      );
    }

    if (isEmojiReaction) {
      return (
        <div key={message.id} className="flex justify-center my-1">
          <div className="bg-accent/50 rounded-full px-3 py-1 text-sm">
            {message.senderAlias} reacted {message.content}
          </div>
        </div>
      );
    }

    return (
      <div key={message.id} className="group mb-3 hover:bg-accent/5 rounded-lg p-2 transition-colors">
        {message.replyToMessage && (
          <div className="ml-10 mb-2 pl-3 border-l-2 border-primary/30 bg-muted/30 rounded-r-md p-2">
            <div className="text-xs text-muted-foreground font-medium">
              Replying to {message.replyToMessage.senderAlias}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {message.replyToMessage.content}
            </div>
          </div>
        )}
        
        <div className="flex gap-3">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={`/avatars/avatar-${message.senderAvatarIndex || 1}.svg`} />
            <AvatarFallback className="text-xs">
              {message.senderAlias.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{message.senderAlias}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
            
            <div className="text-sm">
              {isMediaMessage ? (
                <div className="max-w-xs">
                  {message.attachment?.type?.startsWith('image/') ? (
                    <img 
                      src={message.attachment.url} 
                      alt="Shared media"
                      className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ maxHeight: '200px', objectFit: 'contain' }}
                      onClick={() => window.open(message.attachment.url, '_blank')}
                    />
                  ) : message.attachment?.type?.startsWith('video/') ? (
                    <video 
                      controls
                      className="rounded-lg max-w-full"
                      style={{ maxHeight: '200px' }}
                    >
                      <source src={message.attachment.url} type={message.attachment.type} />
                    </video>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <Paperclip className="w-4 h-4" />
                      <span className="text-sm">{message.content}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="break-words">{message.content}</div>
              )}
            </div>
            
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setReplyingTo(message)}
              >
                <Reply className="w-3 h-3 mr-1" />
                Reply
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  const chatStyles = isFullScreen 
    ? { width: '100vw', height: '100vh', position: 'fixed' as const, top: 0, left: 0, zIndex: 50 }
    : { width: `${chatWidth}px` };

  return (
    <div 
      ref={chatPanelRef}
      className={`bg-background border-l border-border flex flex-col ${
        isFullScreen ? 'fixed inset-0 z-50' : 'relative'
      }`}
      style={chatStyles}
    >
      {/* Resize handle */}
      {!isFullScreen && (
        <div
          ref={resizeHandleRef}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 transition-colors group"
          onMouseDown={handleMouseDown}
        >
          <div className="opacity-0 group-hover:opacity-100 absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-primary/50 rounded-full p-1">
            <GripVertical className="w-3 h-3" />
          </div>
        </div>
      )}

      <Card className="h-full flex flex-col border-0 shadow-none">
        <CardHeader className="py-3 px-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Chat ({participants.length} participants)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="h-7 w-7 p-0"
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="h-7 w-7 p-0"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {enhancedMessages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </div>

          {replyingTo && (
            <div className="border-t bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Replying to {replyingTo.senderAlias}</div>
                  <div className="text-sm truncate">{replyingTo.content}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReplyingTo(null)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>
            </div>
          )}

          <div className="border-t p-4">
            <div className="flex gap-2">
              <div className="flex-1">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-10 p-0"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() && !selectedFile}
                className="h-10"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
        onChange={handleFileSelect}
      />

      {showMediaPreview && selectedFile && (
        <MediaPreviewModal
          isOpen={showMediaPreview}
          file={selectedFile}
          onClose={() => {
            setShowMediaPreview(false);
            setSelectedFile(null);
          }}
          onSend={(file) => {
            setSelectedFile(file);
            setShowMediaPreview(false);
            handleSendMessage();
          }}
        />
      )}
    </div>
  );
};