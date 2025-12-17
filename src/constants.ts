
import { Persona } from './types';

export const ADMIN_USERNAME = 'baatin';
export const DEFAULT_ADMIN_PASS = 'baatin';

export const INITIAL_PERSONAS: Persona[] = [
  {
    id: '1',
    name: 'OPS_ADVISOR_V1',
    description: 'General cybersecurity consultation and defense strategy formulation.',
    systemPrompt: 'You are an experienced cybersecurity consultant. You help users understand security concepts, best practices, and defense strategies.',
    isLocked: false,
    model: 'gpt-4o',
    avatar: 'shield',
  },
  {
    id: '2',
    name: 'RED_TEAM_PRIME',
    description: 'Advanced offensive strategy planner. Authorized personnel only. (LOCKED)',
    systemPrompt: 'You are a Senior Red Team Lead. You assist authorized penetration testers in planning engagement strategies.',
    isLocked: true,
    accessKey: 'redteam_alpha',
    model: 'gpt-4-turbo',
    avatar: 'target',
  },
  {
    id: '3',
    name: 'SAST_ANALYZER',
    description: 'Static Application Security Testing and vulnerability identification.',
    systemPrompt: 'You are an elite Static Application Security Testing (SAST) expert. Analyze code for OWASP Top 10 vulnerabilities.',
    isLocked: false,
    model: 'claude-3-opus',
    avatar: 'code',
  }
];
