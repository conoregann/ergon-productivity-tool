import type { WorkspaceExport } from '../../src/domain/portability.js'

export const workspaceFixture: WorkspaceExport = {
  format: 'ergon',
  version: 1,
  boards: [
    {
      id: '10000000-0000-0000-0000-000000000001',
      title: 'Work',
      background: 'sage',
      archived_at: null,
    },
  ],
  columns: [
    {
      id: '20000000-0000-0000-0000-000000000001',
      board_id: '10000000-0000-0000-0000-000000000001',
      title: 'To do',
      position: 0,
    },
  ],
  cards: [
    {
      id: '30000000-0000-0000-0000-000000000001',
      board_id: '10000000-0000-0000-0000-000000000001',
      column_id: '20000000-0000-0000-0000-000000000001',
      title: 'Proposal',
      description: 'Notes',
      priority: 'high',
      position: 0,
      due_date: '2026-10-09',
      due_time: null,
      completed_at: null,
      archived_at: null,
    },
  ],
  labels: [
    {
      id: '40000000-0000-0000-0000-000000000001',
      board_id: '10000000-0000-0000-0000-000000000001',
      name: 'Work',
      color: '#244e3c',
    },
  ],
  card_labels: [
    {
      board_id: '10000000-0000-0000-0000-000000000001',
      card_id: '30000000-0000-0000-0000-000000000001',
      label_id: '40000000-0000-0000-0000-000000000001',
    },
  ],
  scheduled_sessions: [
    {
      id: '50000000-0000-0000-0000-000000000001',
      card_id: '30000000-0000-0000-0000-000000000001',
      starts_at: '2026-10-09T08:00:00Z',
      ends_at: '2026-10-09T09:00:00Z',
    },
  ],
}
