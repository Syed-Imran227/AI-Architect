import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Layers,
  Compass,
  Trash2,
  Bot,
  User,
  Zap,
  Eye,
  EyeOff,
  Check,
  X,
  Undo2,
  HelpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  sendAgentChat,
  getAgentHistory,
  type AgentChatMessage,
  type AgentChatResponse,
  type LayoutData,
  type VastuResult,
  type NbcResult,
  type EnergyResult,
  type SunlightResult,
  type BomResult,
} from '../../../shared/api-client/api';

interface PlotContext {
  plotWidth: number;
  plotHeight: number;
  entryDir: string;
  [key: string]: any;
}

interface PendingProposal {
  id: string;
  response: AgentChatResponse;
  changeSummary?: {
    action: string;
    target_room?: string | null;
    target_floor_level?: number;
    details?: string;
    is_destructive?: boolean;
    before?: Record<string, any>;
    after?: Record<string, any>;
    [key: string]: any;
  };
  isDestructive: boolean;
  confirmingDestruction?: boolean;
}

interface CopilotAgentPanelProps {
  projectId?: string;
  currentLayout: LayoutData;
  activeFloorLevel: number;
  activeFloorName?: string;
  selectedRoomName?: string | null;
  plotContext: PlotContext;
  onApplyLayout?: (
    updatedLayout: LayoutData,
    imageUrl?: string | null,
    compliance?: {
      vastu?: VastuResult;
      nbc?: NbcResult;
      energy?: EnergyResult;
      sunlight?: SunlightResult;
      bom?: BomResult;
    }
  ) => void;
  onPreviewProposal?: (candidateLayout: LayoutData) => void;
  onCancelPreview?: () => void;
  onApplyProposal?: (
    updatedLayout: LayoutData,
    imageUrl?: string | null,
    compliance?: any,
    changeSummary?: any
  ) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  isPreviewing?: boolean;
  disabled?: boolean;
}

const QUICK_SUGGESTIONS = [
  'Expand Master Bedroom by 2 ft',
  'Swap Kitchen and Dining',
  'Place 3-Seater Sofa in Living Room',
  'Place Queen Bed in Master Bedroom',
  'Shift Living Room right by 1.5 ft',
  'Check Vastu alignment for entrance',
  'Add Balcony 8 by 5 ft',
];

export function CopilotAgentPanel({
  projectId,
  currentLayout,
  activeFloorLevel,
  activeFloorName = 'Ground Floor',
  selectedRoomName,
  plotContext,
  onApplyLayout,
  onPreviewProposal,
  onCancelPreview,
  onApplyProposal,
  onUndo,
  canUndo = false,
  isPreviewing = false,
  disabled = false,
}: CopilotAgentPanelProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [_historyLoading, setHistoryLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [lastWarning, setLastWarning] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  // Structured Pending Proposal State (Never auto-applied without user confirmation)
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null);
  const [isLocalPreviewActive, setIsLocalPreviewActive] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isActuallyPreviewing = isPreviewing || isLocalPreviewActive;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, pendingProposal]);

  // Load chat history when projectId or component mounts
  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const res = await getAgentHistory(projectId);
        if (isMounted) {
          if (res.conversation_id) {
            setConversationId(res.conversation_id);
          }
          if (res.messages && res.messages.length > 0) {
            setMessages(res.messages);
          } else {
            // Initial welcome message if no history exists
            setMessages([
              {
                sender: 'agent',
                content:
                  'Studio Copilot initialized. I can modify room dimensions, shift boundaries, swap spatial zones, arrange furniture, and verify Vastu compliance. Proposed changes can be previewed on canvas before you confirm or undo them.',
                created_at: new Date().toISOString(),
              },
            ]);
          }
        }
      } catch (err) {
        console.warn('Could not load agent conversation history:', err);
        if (isMounted) {
          setMessages([
            {
              sender: 'agent',
              content:
                'Studio Copilot initialized. Type an architectural change such as "Expand Master Bedroom by 2 ft" or "Swap Kitchen and Dining".',
              created_at: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    }

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText ?? inputValue).trim();
    if (!textToSend || loading || disabled) return;

    setInputValue('');
    setLastWarning(null);
    setLastFailedPrompt(null);

    // Append user message optimistically
    const userMsg: AgentChatMessage = {
      sender: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await sendAgentChat({
        project_id: projectId,
        message: textToSend,
        current_layout: currentLayout,
        active_floor_level: activeFloorLevel,
        plot_width: plotContext.plotWidth,
        plot_height: plotContext.plotHeight,
        entry_dir: plotContext.entryDir,
        conversation_id: conversationId,
      });

      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      // Append agent response
      const agentMsg: AgentChatMessage = {
        sender: 'agent',
        content: response.reply,
        operation: response.operation,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, agentMsg]);

      // Check for geometric warnings
      if (response.warnings && response.warnings.length > 0) {
        setLastWarning(response.warnings.join(' • '));
      }

      // Handle Ambiguous Request
      if (response.operation?.action === 'ambiguous_request' || (!response.updated_layout && !response.success)) {
        // Handled via ambiguity card in the UI
        return;
      }

      // If layout was modified successfully: HOLD AS PENDING PROPOSAL (Explicit User Confirmation)
      if (response.updated_layout) {
        const isDestructive = Boolean(response.change_summary?.is_destructive);
        setPendingProposal({
          id: `prop_${Date.now()}`,
          response,
          changeSummary: response.change_summary,
          isDestructive,
          confirmingDestruction: false,
        });

        toast('Architectural proposal ready for review. Click Preview or Apply.', {
          icon: '📐',
          id: 'copilot-proposal-ready',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Agent error: ${msg}`, { id: 'copilot-error' });
      setLastFailedPrompt(textToSend);
      setMessages(prev => [
        ...prev,
        {
          sender: 'agent',
          content: `⚠️ Failed to execute command: ${msg}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Toggle canvas preview of the candidate geometry
  const handleTogglePreview = () => {
    if (!pendingProposal?.response.updated_layout) return;

    if (isActuallyPreviewing) {
      if (onCancelPreview) {
        onCancelPreview();
      }
      setIsLocalPreviewActive(false);
      toast('Canvas preview exited.', { icon: '👁️' });
    } else {
      if (onPreviewProposal) {
        onPreviewProposal(pendingProposal.response.updated_layout);
      }
      setIsLocalPreviewActive(true);
      toast.success('Previewing proposed layout on 2D canvas.');
    }
  };

  // Apply proposed changes into authoritative CommandEngine
  const handleConfirmApply = () => {
    if (!pendingProposal?.response.updated_layout) return;

    const proposal = pendingProposal;
    const { response, changeSummary } = proposal;

    // Check if destructive confirmation is needed first
    if (proposal.isDestructive && !proposal.confirmingDestruction) {
      setPendingProposal({
        ...proposal,
        confirmingDestruction: true,
      });
      return;
    }

    // Cancel preview before applying real change
    if (isActuallyPreviewing && onCancelPreview) {
      onCancelPreview();
    }
    setIsLocalPreviewActive(false);

    const updatedLayout = response.updated_layout;
    if (!updatedLayout) return;

    // Apply through Command Engine
    if (onApplyProposal) {
      onApplyProposal(
        updatedLayout,
        response.imageUrl,
        response.compliance,
        changeSummary
      );
    } else if (onApplyLayout) {
      onApplyLayout(
        updatedLayout,
        response.imageUrl,
        response.compliance
      );
    }

    setPendingProposal(null);

    // Record confirmation message in chat history
    const actionDesc = changeSummary?.details || response.operation?.explanation || 'Applied modifications';
    setMessages(prev => [
      ...prev,
      {
        sender: 'system',
        content: `✓ Applied to floor plan: ${actionDesc}`,
        created_at: new Date().toISOString(),
      },
    ]);
  };

  // Reject / Discard proposed change
  const handleRejectProposal = () => {
    if (isActuallyPreviewing && onCancelPreview) {
      onCancelPreview();
    }
    setIsLocalPreviewActive(false);
    setPendingProposal(null);
    toast('Proposal discarded. Layout remains unchanged.', { icon: '✕' });
    setMessages(prev => [
      ...prev,
      {
        sender: 'system',
        content: '✕ Proposed modification was discarded. Layout unchanged.',
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    if (isActuallyPreviewing && onCancelPreview) {
      onCancelPreview();
    }
    setIsLocalPreviewActive(false);
    setPendingProposal(null);
    setMessages([
      {
        sender: 'agent',
        content: 'Conversation history reset. Ready for your architectural instructions.',
        created_at: new Date().toISOString(),
      },
    ]);
    setLastWarning(null);
    setLastFailedPrompt(null);
  };

  const getActionBadgeColor = (action?: string) => {
    switch (action) {
      case 'resize_room':
        return '#365FA8';
      case 'move_room':
        return '#7C3AED';
      case 'swap_rooms':
        return '#0284C7';
      case 'add_room':
        return '#16A34A';
      case 'remove_room':
        return '#D85740';
      case 'place_furniture':
        return '#B89A64';
      case 'remove_furniture':
        return '#EA580C';
      case 'ambiguous_request':
        return '#D97706';
      default:
        return '#365FA8';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '8px',
        border: '1px solid #E7E1D5',
        background: '#FFFFFF',
        boxShadow: '0 4px 20px rgba(37, 38, 34, 0.06)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header: Studio Desk HUD strip ── */}
      <div
        style={{
          padding: '0.85rem 1.25rem',
          borderBottom: '1px solid #E7E1D5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#FAF8F2',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              background: '#252622',
              border: '1px solid #252622',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FAF8F2',
              boxShadow: '0 2px 6px rgba(37, 38, 34, 0.12)',
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <div
              style={{
                fontWeight: 600,
                color: '#252622',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: "'Newsreader', Georgia, serif",
                letterSpacing: '-0.01em',
                fontSize: '1.15rem',
              }}
            >
              Studio Copilot
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '3px',
                  background: 'rgba(54, 95, 168, 0.08)',
                  color: '#365FA8',
                  border: '1px solid rgba(54, 95, 168, 0.25)',
                  fontFamily: "'JetBrains Mono', monospace",
                  textTransform: 'uppercase',
                }}
              >
                VERIFIED SOLVER
              </span>
            </div>
            <div
              style={{
                fontSize: '0.72rem',
                color: '#64748B',
              }}
            >
              Deterministic geometry • Validated preview • Reversible undo
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {canUndo && onUndo && (
            <button
              onClick={onUndo}
              className="neu-btn-ghost"
              title="Undo last change (Ctrl+Z)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#252622',
                background: '#FFFFFF',
                border: '1px solid #E7E1D5',
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <Undo2 size={13} style={{ color: '#365FA8' }} />
              <span>Undo</span>
            </button>
          )}

          <button
            onClick={handleClearChat}
            className="neu-btn-ghost"
            title="Clear Chat History"
            style={{
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748B',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#D85740')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* ── Active Context Bar ── */}
      <div
        style={{
          padding: '0.45rem 1.25rem',
          background: '#F3F0E7',
          borderBottom: '1px solid #E7E1D5',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.72rem',
          flexWrap: 'wrap',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            color: '#64748B',
            fontWeight: 600,
          }}
        >
          <Layers size={12} style={{ color: '#365FA8' }} />
          <span>LEVEL:</span>
          <strong style={{ color: '#252622' }}>
            {activeFloorName.toUpperCase()} [L{activeFloorLevel}]
          </strong>
        </span>

        {selectedRoomName && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              color: '#64748B',
              fontWeight: 600,
            }}
          >
            <Sliders size={12} style={{ color: '#7C3AED' }} />
            <span>SELECTED:</span>
            <span
              style={{
                background: 'rgba(54, 95, 168, 0.08)',
                color: '#365FA8',
                border: '1px solid rgba(54, 95, 168, 0.3)',
                padding: '0px 5px',
                borderRadius: '3px',
                fontWeight: 700,
              }}
            >
              {selectedRoomName}
            </span>
          </span>
        )}

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            color: '#64748B',
            marginLeft: 'auto',
          }}
        >
          <Compass size={12} style={{ color: '#B89A64' }} />
          <span>PLOT:</span>
          <strong style={{ color: '#252622' }}>
            {plotContext.plotWidth}×{plotContext.plotHeight} ft ({plotContext.entryDir.toUpperCase()})
          </strong>
        </span>
      </div>

      {/* ── Warning Alert (if any) ── */}
      {lastWarning && (
        <div
          style={{
            padding: '0.5rem 1.25rem',
            background: 'rgba(216, 87, 64, 0.08)',
            borderBottom: '1px solid rgba(216, 87, 64, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#D85740',
            fontSize: '0.72rem',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          <span>{lastWarning}</span>
        </div>
      )}

      {/* ── Messages Feed ── */}
      <div
        style={{
          padding: '1rem 1.25rem',
          height: '340px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          background: '#FAF8F2',
        }}
      >
        {messages.map((msg, idx) => {
          const isUser = msg.sender === 'user';
          const isSystem = msg.sender === 'system';
          const isAmbiguous = msg.operation?.action === 'ambiguous_request';

          if (isSystem) {
            return (
              <div
                key={idx}
                style={{
                  alignSelf: 'center',
                  maxWidth: '90%',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  background: '#F3F0E7',
                  border: '1px solid #E7E1D5',
                  fontSize: '0.72rem',
                  color: '#474943',
                  fontFamily: "'JetBrains Mono', monospace",
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>{msg.content}</span>
                {canUndo && onUndo && msg.content.includes('Applied') && (
                  <button
                    onClick={onUndo}
                    style={{
                      marginLeft: '0.5rem',
                      background: 'transparent',
                      border: 'none',
                      color: '#365FA8',
                      cursor: 'pointer',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      textDecoration: 'underline',
                    }}
                  >
                    <Undo2 size={11} /> Undo
                  </button>
                )}
              </div>
            );
          }

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                gap: '0.25rem',
              }}
            >
              {/* Sender label */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.68rem',
                  color: isUser ? '#252622' : '#365FA8',
                  fontWeight: 700,
                  padding: '0 0.25rem',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {isUser ? (
                  <>
                    <span>OPERATOR</span>
                    <User size={10} />
                  </>
                ) : (
                  <>
                    <Bot size={11} style={{ color: '#365FA8' }} />
                    <span>ARCHITECTURAL COPILOT</span>
                  </>
                )}
              </div>

              {/* Message bubble */}
              <div
                style={{
                  maxWidth: '88%',
                  padding: '0.75rem 0.95rem',
                  borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: isUser ? '#252622' : '#FFFFFF',
                  color: isUser ? '#FAF8F2' : '#252622',
                  border: isUser ? '1px solid #252622' : '1px solid #E7E1D5',
                  boxShadow: isUser
                    ? '0 2px 8px rgba(37, 38, 34, 0.12)'
                    : '0 2px 8px rgba(37, 38, 34, 0.04)',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}

                {/* Ambiguity Clarification Box */}
                {isAmbiguous && (
                  <div
                    style={{
                      marginTop: '0.6rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '6px',
                      background: 'rgba(217, 119, 6, 0.08)',
                      border: '1px solid rgba(217, 119, 6, 0.3)',
                      color: '#92400E',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontWeight: 700,
                        fontSize: '0.74rem',
                        marginBottom: '0.3rem',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      <HelpCircle size={13} />
                      <span>CLARIFICATION NEEDED</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                      Please specify the target room name or exact dimensions. Click a suggestion below to proceed:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {['Expand Master Bedroom by 2 ft', 'Expand Living Room by 3 ft', 'Add Balcony 8 by 5 ft'].map((pill, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleSendMessage(pill)}
                          style={{
                            fontSize: '0.7rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: '#FFFFFF',
                            border: '1px solid rgba(217, 119, 6, 0.4)',
                            color: '#78350F',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {pill}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Operation Pill Badge */}
                {msg.operation && msg.operation.action !== 'general_advice' && !isAmbiguous && (
                  <div
                    style={{
                      marginTop: '0.6rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      background: '#FAF8F2',
                      border: `1px solid ${getActionBadgeColor(msg.operation.action)}40`,
                      fontSize: '0.72rem',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontWeight: 700,
                        color: getActionBadgeColor(msg.operation.action),
                        marginBottom: '0.2rem',
                      }}
                    >
                      <Zap size={12} />
                      <span>[ACTION: {msg.operation.action.toUpperCase()}]</span>
                      {msg.operation.target_room_name && (
                        <span
                          style={{
                            background: 'rgba(37, 38, 34, 0.06)',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            color: '#252622',
                          }}
                        >
                          Target: {msg.operation.target_room_name}
                        </span>
                      )}
                    </div>

                    {msg.operation.parameters && Object.keys(msg.operation.parameters).length > 0 && (
                      <div
                        style={{
                          fontSize: '0.68rem',
                          opacity: 0.85,
                          color: '#64748B',
                          marginTop: '2px',
                        }}
                      >
                        {Object.entries(msg.operation.parameters)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' • ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator with typing pulse */}
        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.65rem 0.95rem',
              borderRadius: '12px 12px 12px 2px',
              background: '#FFFFFF',
              border: '1px solid #E7E1D5',
              width: 'fit-content',
              fontSize: '0.76rem',
              color: '#365FA8',
              fontFamily: "'JetBrains Mono', monospace",
              boxShadow: '0 2px 8px rgba(37, 38, 34, 0.04)',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                border: '2px solid rgba(54, 95, 168, 0.2)',
                borderTopColor: '#365FA8',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span>SOLVING SPATIAL MATRIX...</span>
            <span style={{ animation: 'pulse 1s infinite', fontWeight: 800 }}>▌</span>
          </div>
        )}

        {/* Retry button on error */}
        {lastFailedPrompt && !loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              background: 'rgba(216, 87, 64, 0.08)',
              border: '1px solid rgba(216, 87, 64, 0.3)',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: '#D85740', fontFamily: "'JetBrains Mono', monospace" }}>
              Request interrupted.
            </span>
            <button
              onClick={() => handleSendMessage(lastFailedPrompt)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#FAF8F2',
                background: '#D85740',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 8px',
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <RotateCcw size={11} /> Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Pending Proposal Confirmation HUD (Phase Two & Three) ── */}
      <AnimatePresence>
        {pendingProposal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              borderTop: '2px solid #365FA8',
              background: '#FFFFFF',
              padding: '0.85rem 1.25rem',
              boxShadow: '0 -4px 16px rgba(37, 38, 34, 0.08)',
            }}
          >
            {/* Header Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: getActionBadgeColor(pendingProposal.response.operation?.action),
                    color: '#FAF8F2',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  PROPOSED: {pendingProposal.response.operation?.action?.toUpperCase() || 'MODIFICATION'}
                </span>
                {pendingProposal.changeSummary?.target_room && (
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#252622',
                      fontFamily: "'Newsreader', Georgia, serif",
                    }}
                  >
                    {pendingProposal.changeSummary.target_room}
                  </span>
                )}
              </div>

              <span
                style={{
                  fontSize: '0.68rem',
                  color: '#64748B',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Awaiting Operator Approval
              </span>
            </div>

            {/* Change explanation */}
            <div
              style={{
                fontSize: '0.78rem',
                color: '#474943',
                lineHeight: 1.4,
                marginBottom: '0.6rem',
              }}
            >
              {pendingProposal.changeSummary?.details ||
                pendingProposal.response.operation?.explanation ||
                'Spatial modification ready to apply.'}
            </div>

            {/* Before vs After Metrics Comparison */}
            {pendingProposal.changeSummary?.before && pendingProposal.changeSummary?.after && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  background: '#FAF8F2',
                  borderRadius: '6px',
                  border: '1px solid #E7E1D5',
                  marginBottom: '0.65rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.72rem',
                }}
              >
                <div>
                  <div style={{ color: '#94A3B8', fontSize: '0.65rem', fontWeight: 700 }}>PREVIOUS STATE</div>
                  <div style={{ color: '#64748B', marginTop: '2px' }}>
                    {pendingProposal.changeSummary.before.width !== undefined && (
                      <div>
                        Size: {pendingProposal.changeSummary.before.width}×{pendingProposal.changeSummary.before.height} ft
                      </div>
                    )}
                    {pendingProposal.changeSummary.before.area_sqft !== undefined && (
                      <div>Area: {pendingProposal.changeSummary.before.area_sqft} sq ft</div>
                    )}
                    {pendingProposal.changeSummary.before.x !== undefined && (
                      <div>Pos: ({pendingProposal.changeSummary.before.x}, {pendingProposal.changeSummary.before.y})</div>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ color: '#365FA8', fontSize: '0.65rem', fontWeight: 700 }}>PROPOSED STATE</div>
                  <div style={{ color: '#252622', fontWeight: 600, marginTop: '2px' }}>
                    {pendingProposal.changeSummary.after.width !== undefined && (
                      <div>
                        Size: {pendingProposal.changeSummary.after.width}×{pendingProposal.changeSummary.after.height} ft
                      </div>
                    )}
                    {pendingProposal.changeSummary.after.area_sqft !== undefined && (
                      <div style={{ color: '#16A34A' }}>
                        Area: {pendingProposal.changeSummary.after.area_sqft} sq ft
                      </div>
                    )}
                    {pendingProposal.changeSummary.after.x !== undefined && (
                      <div>Pos: ({pendingProposal.changeSummary.after.x}, {pendingProposal.changeSummary.after.y})</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Destructive Warning Confirmation */}
            {pendingProposal.isDestructive && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(216, 87, 64, 0.08)',
                  border: '1px solid rgba(216, 87, 64, 0.3)',
                  marginBottom: '0.65rem',
                  fontSize: '0.74rem',
                  color: '#D85740',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>
                  {pendingProposal.confirmingDestruction
                    ? '⚠️ Please confirm: This action permanently removes walls and interior fixtures.'
                    : 'Destructive operation: Room deletion will unseat associated walls and items.'}
                </span>
              </div>
            )}

            {/* Action Buttons: Preview, Apply, Reject */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={handleTogglePreview}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: isActuallyPreviewing ? '1px solid #365FA8' : '1px solid #E7E1D5',
                  background: isActuallyPreviewing ? '#EFF6FF' : '#FFFFFF',
                  color: isActuallyPreviewing ? '#365FA8' : '#252622',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: 'all 0.15s ease',
                }}
              >
                {isActuallyPreviewing ? (
                  <>
                    <EyeOff size={13} /> Exit Preview
                  </>
                ) : (
                  <>
                    <Eye size={13} /> Preview Canvas
                  </>
                )}
              </button>

              <button
                onClick={handleConfirmApply}
                style={{
                  flex: 1.2,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: pendingProposal.isDestructive ? '#D85740' : '#252622',
                  color: '#FAF8F2',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  boxShadow: '0 2px 6px rgba(37, 38, 34, 0.15)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Check size={13} />
                <span>
                  {pendingProposal.isDestructive
                    ? pendingProposal.confirmingDestruction
                      ? 'Confirm Deletion'
                      : 'Delete Room'
                    : 'Apply Modification'}
                </span>
              </button>

              <button
                onClick={handleRejectProposal}
                title="Discard proposal without modifying layout"
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #E7E1D5',
                  background: '#FFFFFF',
                  color: '#64748B',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#D85740')}
                onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
              >
                <X size={13} />
                <span>Reject</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick Suggestions Bar ── */}
      <div
        style={{
          padding: '0.45rem 1.25rem',
          background: '#FAF8F2',
          borderTop: '1px solid #E7E1D5',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
        }}
      >
        <span
          style={{
            fontSize: '0.65rem',
            color: '#64748B',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            flexShrink: 0,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          SUGGESTIONS:
        </span>
        {QUICK_SUGGESTIONS.map((sug, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(sug)}
            disabled={loading || disabled}
            style={{
              fontSize: '0.7rem',
              padding: '3px 8px',
              borderRadius: '6px',
              border: '1px solid #E7E1D5',
              background: '#FFFFFF',
              color: '#474943',
              cursor: loading || disabled ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            onMouseEnter={e => {
              if (!loading && !disabled) {
                e.currentTarget.style.borderColor = '#365FA8';
                e.currentTarget.style.color = '#365FA8';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(54, 95, 168, 0.12)';
                e.currentTarget.style.transform = 'scale(1.02)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E7E1D5';
              e.currentTarget.style.color = '#474943';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {sug}
          </button>
        ))}
      </div>

      {/* ── Chat Input ── */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid #E7E1D5',
          background: '#FAF8F2',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={inputRef}
          rows={2}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Generate or load a layout first...'
              : 'e.g., Expand Master Bedroom by 2 ft, swap kitchen & dining, add sofa...'
          }
          disabled={loading || disabled}
          style={{
            flex: 1,
            resize: 'none',
            fontSize: '0.82rem',
            padding: '0.55rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid #E7E1D5',
            background: '#FFFFFF',
            color: '#252622',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            outline: 'none',
            lineHeight: 1.4,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#365FA8')}
          onBlur={e => (e.currentTarget.style.borderColor = '#E7E1D5')}
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={loading || !inputValue.trim() || disabled}
          style={{
            height: '40px',
            padding: '0 1.1rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            fontSize: '0.8rem',
            fontWeight: 800,
            background: loading || !inputValue.trim() || disabled ? '#E7E1D5' : '#252622',
            color: loading || !inputValue.trim() || disabled ? '#777970' : '#FAF8F2',
            cursor: loading || !inputValue.trim() || disabled ? 'not-allowed' : 'pointer',
            border: 'none',
            boxShadow:
              loading || !inputValue.trim() || disabled ? 'none' : '0 2px 8px rgba(37, 38, 34, 0.15)',
            transition: 'all 0.15s ease',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.04em',
          }}
        >
          {loading ? (
            <div
              style={{
                width: '14px',
                height: '14px',
                border: '2px solid rgba(0,0,0,0.2)',
                borderTopColor: '#090A0F',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          ) : (
            <>
              <span>SEND</span>
              <Send size={13} />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

export default CopilotAgentPanel;
