import type { Page } from '@playwright/test'
import type { Preferences, Session } from '../../src/domain/scheduling.js'
import type { BoardSnapshot } from '../../src/domain/kanban.js'

const owner = '00000000-0000-0000-0000-000000000001'
export async function installBackend(page: Page) {
  const base = {
    owner_id: owner,
    created_at: '2026-10-08T09:00:00Z',
    updated_at: '2026-10-08T09:00:00Z',
    version: 1,
  }
  const boards = new Map<string, BoardSnapshot>()
  const sessions = new Map<string, Session>()
  let preferences: Preferences | null = null
  const control = {
    failNext: false,
    conflictNext: false,
    delayNext: 0,
    legacyBoardSnapshot: false,
  }
  await page.addInitScript(
    ({ owner }) => {
      const jwt =
        btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) +
        '.' +
        btoa(
          JSON.stringify({
            sub: owner,
            aud: 'authenticated',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ) +
        '.signature'
      localStorage.setItem(
        'sb-ergon-auth-token',
        JSON.stringify({
          access_token: jwt,
          refresh_token: 'test-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: owner,
            email: 'test@example.com',
            aud: 'authenticated',
            app_metadata: {},
            user_metadata: {},
          },
        }),
      )
    },
    { owner },
  )
  await page.route('https://ergon.test/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const respond = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
        headers: { 'Access-Control-Allow-Origin': '*' },
      })
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      })
    if (path === '/auth/v1/user')
      return respond({
        id: owner,
        email: 'test@example.com',
        aud: 'authenticated',
        app_metadata: {},
        user_metadata: {},
      })
    if (path === '/auth/v1/logout') return respond({})
    if (path === '/rest/v1/boards')
      return respond([...boards.values()].map((snapshot) => snapshot.board))
    const name = path.split('/').at(-1)
    const args = route.request().postDataJSON() as Record<string, unknown>
    if (name === 'create_board') {
      const id = crypto.randomUUID()
      boards.set(id, {
        board: {
          ...base,
          id,
          title: String(args.p_title),
          archived_at: null,
          background: 'neutral',
        },
        columns: ['To do', 'In progress', 'Done'].map((title, position) => ({
          ...base,
          id: crypto.randomUUID(),
          board_id: id,
          title,
          position,
        })),
        labels: [],
        cardLabels: [],
        cards: [],
      })
      return respond(id)
    }
    if (name === 'get_scheduling_snapshot')
      return respond({
        boards: [...boards.values()].map((item) => item.board),
        cards: [...boards.values()].flatMap((item) => item.cards),
        sessions: [...sessions.values()],
        labels: [...boards.values()].flatMap((item) => item.labels),
        card_labels: [...boards.values()].flatMap((item) => item.cardLabels),
        preferences,
      })
    if (name === 'save_calendar_preferences') {
      if (control.failNext) {
        control.failNext = false
        return respond(
          { code: 'P0001', message: 'Simulated write failure' },
          400,
        )
      }
      if (
        control.conflictNext ||
        args.p_version !== (preferences?.version ?? 0)
      ) {
        control.conflictNext = false
        preferences = {
          timezone: preferences?.timezone ?? 'UTC',
          week_starts_on: preferences?.week_starts_on ?? 1,
          calendar_view: preferences?.calendar_view ?? 'week',
          version: (preferences?.version ?? 0) + 1,
        }
        return respond({ code: 'PT409', message: 'Preferences changed' }, 409)
      }
      preferences = {
        timezone: String(args.p_timezone),
        week_starts_on: Number(args.p_week_starts_on),
        calendar_view: String(args.p_calendar_view),
        version: (preferences?.version ?? 0) + 1,
      }
      return respond(null)
    }
    if (['create_session', 'save_session', 'delete_session'].includes(name!)) {
      if (control.failNext) {
        control.failNext = false
        return respond(
          { code: 'P0001', message: 'Simulated write failure' },
          400,
        )
      }
      const session = sessions.get(String(args.p_id))
      if (
        control.conflictNext ||
        (name !== 'create_session' && session?.version !== args.p_version)
      ) {
        control.conflictNext = false
        if (session) session.version++
        return respond({ code: 'PT409', message: 'Session changed' }, 409)
      }
      if (name === 'create_session')
        sessions.set(String(args.p_id), {
          ...base,
          id: String(args.p_id),
          card_id: String(args.p_card_id),
          starts_at: String(args.p_starts_at),
          ends_at: String(args.p_ends_at),
        })
      if (name === 'save_session' && session)
        Object.assign(session, {
          starts_at: args.p_starts_at,
          ends_at: args.p_ends_at,
          version: session.version + 1,
        })
      if (name === 'delete_session') sessions.delete(String(args.p_id))
      return respond(name === 'create_session' ? args.p_id : null)
    }
    const snapshot = boards.get(String(args.p_board_id))
    if (!snapshot) return respond(null)
    if (name === 'get_board_snapshot')
      return respond(
        control.legacyBoardSnapshot
          ? {
              board: snapshot.board,
              columns: snapshot.columns,
              cards: snapshot.cards,
            }
          : snapshot,
      )
    if (control.delayNext) {
      const delay = control.delayNext
      control.delayNext = 0
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    if (control.failNext) {
      control.failNext = false
      return respond({ code: 'P0001', message: 'Simulated write failure' }, 400)
    }
    if (control.conflictNext) {
      control.conflictNext = false
      snapshot.board.version++
      return respond({ code: 'PT409', message: 'Board changed' }, 409)
    }
    if (args.p_version !== snapshot.board.version)
      return respond({ code: 'PT409', message: 'Board changed' }, 409)
    let result: unknown = null
    const columnId = String(args.p_column_id)
    const cardId = String(args.p_card_id)
    const column = snapshot.columns.find((column) => column.id === columnId)
    const card = snapshot.cards.find((card) => card.id === cardId)
    if (name === 'create_label') {
      result = crypto.randomUUID()
      snapshot.labels.push({
        ...base,
        id: String(result),
        board_id: snapshot.board.id,
        name: String(args.p_name),
        color: String(args.p_color),
      })
    }
    if (name === 'save_label') {
      const label = snapshot.labels.find(
        (label) => label.id === args.p_label_id,
      )
      if (label)
        Object.assign(label, { name: args.p_name, color: args.p_color })
    }
    if (name === 'delete_label') {
      snapshot.labels = snapshot.labels.filter(
        (label) => label.id !== args.p_label_id,
      )
      snapshot.cardLabels = snapshot.cardLabels.filter(
        (link) => link.label_id !== args.p_label_id,
      )
    }
    if (name === 'create_column') {
      result = crypto.randomUUID()
      snapshot.columns.push({
        ...base,
        id: String(result),
        board_id: snapshot.board.id,
        title: String(args.p_title),
        position: snapshot.columns.length,
      })
    }
    if (name === 'save_column' && column) column.title = String(args.p_title)
    if (name === 'delete_column')
      snapshot.columns = snapshot.columns.filter(
        (column) => column.id !== columnId,
      )
    if (name === 'move_column' && column) {
      snapshot.columns = snapshot.columns.filter((item) => item.id !== columnId)
      const index = args.p_before_id
        ? snapshot.columns.findIndex((item) => item.id === args.p_before_id)
        : snapshot.columns.length
      snapshot.columns.splice(index, 0, column)
      snapshot.columns.forEach((item, index) => (item.position = index))
    }
    if (name === 'create_card') {
      result = crypto.randomUUID()
      snapshot.cards.push({
        ...base,
        id: String(result),
        board_id: snapshot.board.id,
        column_id: columnId,
        title: String(args.p_title),
        description: String(args.p_description ?? ''),
        priority: String(args.p_priority ?? 'none'),
        due_date: args.p_due_date as string | null,
        due_time: args.p_due_time as string | null,
        archived_at: null,
        completed_at: null,
        position: snapshot.cards.filter((card) => card.column_id === columnId)
          .length,
      })
    }
    if (name === 'save_card' && card)
      Object.assign(card, {
        title: args.p_title,
        description: args.p_description,
        priority: args.p_priority ?? card.priority,
        due_date: args.p_due_date,
        due_time: args.p_due_time as string | null,
        archived_at: args.p_archived ? new Date().toISOString() : null,
        completed_at: args.p_completed ? new Date().toISOString() : null,
      })
    if (
      (name === 'create_card' || name === 'save_card') &&
      Array.isArray(args.p_label_ids)
    ) {
      const assignedCard = name === 'create_card' ? String(result) : cardId
      snapshot.cardLabels = [
        ...snapshot.cardLabels.filter((link) => link.card_id !== assignedCard),
        ...args.p_label_ids.map((labelId) => ({
          owner_id: owner,
          board_id: snapshot.board.id,
          card_id: assignedCard,
          label_id: String(labelId),
        })),
      ]
    }
    if (name === 'delete_card') {
      snapshot.cards = snapshot.cards.filter((card) => card.id !== cardId)
      snapshot.cardLabels = snapshot.cardLabels.filter(
        (link) => link.card_id !== cardId,
      )
    }
    if (name === 'move_card' && card) {
      snapshot.cards = snapshot.cards.filter((item) => item.id !== cardId)
      card.column_id = columnId
      const target = snapshot.cards
        .filter((item) => item.column_id === columnId)
        .sort((a, b) => a.position - b.position)
      const index = args.p_before_id
        ? target.findIndex((item) => item.id === args.p_before_id)
        : target.length
      target.splice(index, 0, card)
      target.forEach((item, index) => (item.position = index))
      snapshot.cards = [
        ...snapshot.cards.filter((item) => item.column_id !== columnId),
        ...target,
      ]
    }
    if (name === 'save_board')
      Object.assign(snapshot.board, {
        title: args.p_title,
        background: args.p_background ?? snapshot.board.background,
        archived_at: args.p_archived ? new Date().toISOString() : null,
      })
    if (name === 'delete_board') boards.delete(snapshot.board.id)
    snapshot.board.version++
    return respond(result)
  })
  return Object.assign(control, { seed: { boards, sessions } })
}
