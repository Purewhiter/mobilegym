// Browser agent registry.
//
// Each entry is a BaseAgent subclass mirroring a bench_env/agent implementation.
import { AutoGLMAgent } from './autoglm.js';
import { GenericV2Agent } from './generic_v2.js';

export const AGENT_CLASSES = {
  [GenericV2Agent.id]: GenericV2Agent,
  [AutoGLMAgent.id]: AutoGLMAgent,
};

export const AGENT_ORDER = [GenericV2Agent.id, AutoGLMAgent.id];

export const DEFAULT_AGENT_ID = GenericV2Agent.id;

export const ARG_FIELDS = [
  { key: 'temperature', label: 'Temperature', step: '0.05', min: '0', max: '2' },
  { key: 'top_p', label: 'Top P', step: '0.05', min: '0', max: '1' },
  { key: 'max_tokens', label: 'Max tokens', step: '1', min: '1', max: '32768' },
  { key: 'frequency_penalty', label: 'Frequency penalty', step: '0.1', min: '-2', max: '2' },
];

export function getAgentClass(id) {
  return AGENT_CLASSES[id] || AGENT_CLASSES[DEFAULT_AGENT_ID];
}

export function getAgentMeta(id) {
  const AgentClass = getAgentClass(id);
  return {
    id: AgentClass.id,
    label: AgentClass.label,
    blurb: AgentClass.blurb,
    defaultArgs: AgentClass.defaultArgs || {},
  };
}

export function createAgent(id, cfg, args) {
  const AgentClass = getAgentClass(id);
  return new AgentClass(cfg, args);
}
