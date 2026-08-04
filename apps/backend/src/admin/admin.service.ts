import { prisma } from '../db.js';

const AUDIT_LOG_LIMIT = 100;

// Merges two distinct event sources — StatusEvent (lifecycle transitions:
// created/approved/rejected/cancelled) and ItemEdit (moderator content
// changes) — into one chronological feed for the admin panel. They're
// separate tables with different shapes (see the ItemEdit model comment in
// schema.prisma for why), so this is an application-level merge rather than
// a SQL UNION; fine at this project's scale.
export async function getAuditLog() {
  const [statusEvents, itemEdits] = await Promise.all([
    prisma.statusEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: AUDIT_LOG_LIMIT,
      include: {
        item: { select: { title: true } },
        actor: { select: { name: true } },
      },
    }),
    prisma.itemEdit.findMany({
      orderBy: { createdAt: 'desc' },
      take: AUDIT_LOG_LIMIT,
      include: {
        item: { select: { title: true } },
        actor: { select: { name: true } },
      },
    }),
  ]);

  const statusEntries = statusEvents.map((e) => ({
    type: 'STATUS_CHANGE' as const,
    id: e.id,
    itemId: e.itemId,
    itemTitle: e.item.title,
    actorId: e.actorId,
    actorName: e.actor?.name ?? null,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    reason: e.reason,
    createdAt: e.createdAt,
  }));

  const editEntries = itemEdits.map((e) => ({
    type: 'EDIT' as const,
    id: e.id,
    itemId: e.itemId,
    itemTitle: e.item.title,
    actorId: e.actorId,
    actorName: e.actor?.name ?? null,
    before: e.before,
    after: e.after,
    createdAt: e.createdAt,
  }));

  return [...statusEntries, ...editEntries]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, AUDIT_LOG_LIMIT);
}
