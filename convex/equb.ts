import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import {
  advanceCycle,
  approvePayout,
  drawWinner,
  recordContribution,
  startNextRotation,
  validateMemberIdentity,
  verifyContribution,
} from "../src/core/engine/engine";
import type {
  Contribution,
  Cycle,
  DrawRecord,
  EqubState,
  Member,
  Payout,
} from "../src/core/engine/types";
import { equbStateValidator } from "./schema";

const recordKinds = ["member", "contribution", "cycle", "payout", "draw"] as const;
type RecordKind = (typeof recordKinds)[number];
type AccessRole = "admin" | "member";
interface AccessContext {
  equb: Doc<"equbs">;
  role: AccessRole;
  memberId: string | null;
  tokenIdentifier: string;
}
type RecordData =
  | ({ kind: "member" } & Member)
  | ({ kind: "contribution" } & Contribution)
  | ({ kind: "cycle" } & Cycle)
  | ({ kind: "payout" } & Payout)
  | ({ kind: "draw" } & DrawRecord);
type StoredRecords = Record<RecordKind, Doc<"records">[]>;

const MAX_RECORDS: Record<RecordKind, number> = {
  member: 500,
  contribution: 8000,
  cycle: 500,
  payout: 1000,
  draw: 1000,
};

async function ownerTokenIdentifier(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Sign in is required.");
  return identity.tokenIdentifier;
}

async function getOwnedEqub(ctx: QueryCtx | MutationCtx, owner: string): Promise<Doc<"equbs">> {
  const equb = await ctx.db
    .query("equbs")
    .withIndex("by_owner", (q) => q.eq("ownerTokenIdentifier", owner))
    .unique();
  if (!equb) throw new ConvexError("Your Equb account has not been initialized.");
  return equb;
}

async function getAccess(ctx: QueryCtx | MutationCtx): Promise<AccessContext | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const ownedEqub = await ctx.db
    .query("equbs")
    .withIndex("by_owner", (q) => q.eq("ownerTokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (ownedEqub) {
    return { equb: ownedEqub, role: "admin", memberId: null, tokenIdentifier: identity.tokenIdentifier };
  }

  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!membership) return null;

  const equb = await ctx.db.get(membership.equbId);
  if (!equb) throw new ConvexError("This Equb membership is no longer valid.");
  const memberDocs = await ctx.db
    .query("records")
    .withIndex("by_equb_and_kind", (q) => q.eq("equbId", equb._id).eq("kind", "member"))
    .take(MAX_RECORDS.member + 1);
  if (memberDocs.length > MAX_RECORDS.member) {
    throw new ConvexError("This Equb has reached the supported member record limit.");
  }
  const member = memberDocs.find((doc) => doc.record.kind === "member" && doc.record.id === membership.memberId);
  if (!member || member.record.kind !== "member" || member.record.status !== "active") {
    throw new ConvexError("This member account is inactive.");
  }

  return {
    equb,
    role: membership.role,
    memberId: membership.memberId,
    tokenIdentifier: identity.tokenIdentifier,
  };
}

async function requireAccess(ctx: QueryCtx | MutationCtx): Promise<AccessContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Sign in is required.");
  const access = await getAccess(ctx);
  if (!access) throw new ConvexError("You are not a member of an Equb.");
  return access;
}

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<AccessContext> {
  const access = await requireAccess(ctx);
  if (access.role !== "admin") throw new ConvexError("Administrator access is required.");
  return access;
}

async function createJoinCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
    const existing = await ctx.db
      .query("equbs")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .unique();
    if (!existing) return code;
  }
  throw new ConvexError("Could not generate a unique group code. Please try again.");
}

async function readRecords(ctx: QueryCtx | MutationCtx, equbId: Id<"equbs">): Promise<StoredRecords> {
  const entries = await Promise.all(recordKinds.map(async (kind) => {
    const docs = await ctx.db
      .query("records")
      .withIndex("by_equb_and_kind", (q) => q.eq("equbId", equbId).eq("kind", kind))
      .take(MAX_RECORDS[kind] + 1);
    if (docs.length > MAX_RECORDS[kind]) {
      throw new ConvexError(`This Equb has reached the supported ${kind} record limit.`);
    }
    return [kind, docs] as const;
  }));
  return Object.fromEntries(entries) as StoredRecords;
}

function recordsToState(equb: Doc<"equbs">, stored: StoredRecords): EqubState {
  const members: Member[] = stored.member.flatMap(({ record }) => {
    if (record.kind !== "member") throw new ConvexError("Stored member data is invalid.");
    const { kind: _kind, ...member } = record;
    return [member];
  });
  const contributions: Contribution[] = stored.contribution.flatMap(({ record }) => {
    if (record.kind !== "contribution") throw new ConvexError("Stored contribution data is invalid.");
    const { kind: _kind, ...contribution } = record;
    return [contribution];
  });
  const cycles: Cycle[] = stored.cycle.flatMap(({ record }) => {
    if (record.kind !== "cycle") throw new ConvexError("Stored cycle data is invalid.");
    const { kind: _kind, ...cycle } = record;
    return [cycle];
  });
  const payouts: Payout[] = stored.payout.flatMap(({ record }) => {
    if (record.kind !== "payout") throw new ConvexError("Stored payout data is invalid.");
    const { kind: _kind, ...payout } = record;
    return [payout];
  });
  const draws: DrawRecord[] = stored.draw.flatMap(({ record }) => {
    if (record.kind !== "draw") throw new ConvexError("Stored draw data is invalid.");
    const { kind: _kind, ...draw } = record;
    return [draw];
  });

  for (const kind of recordKinds) {
    stored[kind].sort((a, b) => a.position - b.position);
  }
  const ordered = <T extends { id: string }>(records: T[], kind: RecordKind): T[] => {
    const positions = new Map(stored[kind].map((doc) => [doc.record.id, doc.position]));
    return records.sort((a, b) => (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0));
  };

  return {
    groupName: equb.groupName,
    currency: equb.currency,
    contributionAmount: equb.contributionAmount,
    frequency: equb.frequency,
    currentRotation: equb.currentRotation,
    members: ordered(members, "member"),
    contributions: ordered(contributions, "contribution"),
    cycles: ordered(cycles, "cycle"),
    payouts: ordered(payouts, "payout"),
    draws: ordered(draws, "draw"),
  };
}

function tagStateRecords(state: EqubState): Record<RecordKind, RecordData[]> {
  return {
    member: state.members.map((record) => ({ kind: "member", ...record })),
    contribution: state.contributions.map((record) => ({ kind: "contribution", ...record })),
    cycle: state.cycles.map((record) => ({ kind: "cycle", ...record })),
    payout: state.payouts.map((record) => ({ kind: "payout", ...record })),
    draw: (state.draws ?? []).map((record) => ({ kind: "draw", ...record })),
  };
}

async function saveState(
  ctx: MutationCtx,
  equb: Doc<"equbs">,
  stored: StoredRecords,
  state: EqubState,
): Promise<void> {
  const next = tagStateRecords(state);
  for (const kind of recordKinds) {
    const oldById = new Map(stored[kind].map((doc) => [doc.record.id, doc]));
    const retainedIds = new Set<string>();
    for (const [position, record] of next[kind].entries()) {
      retainedIds.add(record.id);
      const old = oldById.get(record.id);
      if (!old) {
        await ctx.db.insert("records", { equbId: equb._id, kind, position, record });
      } else if (old.position !== position || JSON.stringify(old.record) !== JSON.stringify(record)) {
        await ctx.db.patch(old._id, { position, record });
      }
    }
    for (const old of stored[kind]) {
      if (!retainedIds.has(old.record.id)) await ctx.db.delete(old._id);
    }
  }
  await ctx.db.patch(equb._id, {
    groupName: state.groupName,
    currency: "ETB",
    contributionAmount: state.contributionAmount,
    frequency: "monthly",
    currentRotation: state.currentRotation ?? 1,
  });
}

async function changeState(
  ctx: MutationCtx,
  transform: (state: EqubState) => EqubState,
  memberScope?: string,
): Promise<EqubState> {
  const access = await requireAccess(ctx);
  if (access.role !== "admin" && (!memberScope || access.memberId !== memberScope)) {
    throw new ConvexError("You do not have permission to perform this action.");
  }
  const stored = await readRecords(ctx, access.equb._id);
  const state = recordsToState(access.equb, stored);
  const updated = transform(state);
  await saveState(ctx, access.equb, stored, updated);
  return updated;
}

export const ensureEqub = mutation({
  args: {},
  returns: v.id("equbs"),
  handler: async (ctx) => {
    const owner = await ownerTokenIdentifier(ctx);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", owner))
      .unique();
    if (membership) throw new ConvexError("A member account cannot create another Equb.");
    const existing = await ctx.db
      .query("equbs")
      .withIndex("by_owner", (q) => q.eq("ownerTokenIdentifier", owner))
      .unique();
    if (existing) {
      if (!existing.joinCode) await ctx.db.patch(existing._id, { joinCode: await createJoinCode(ctx) });
      return existing._id;
    }

    const now = new Date();
    const cycleId = `cycle-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 25).toISOString();
    const equbId = await ctx.db.insert("equbs", {
      ownerTokenIdentifier: owner,
      joinCode: await createJoinCode(ctx),
      groupName: "My Equb",
      currency: "ETB",
      contributionAmount: 5000,
      frequency: "monthly",
      currentRotation: 1,
      importedFromDevice: false,
    });
    await ctx.db.insert("records", {
      equbId,
      kind: "cycle",
      position: 0,
      record: {
        kind: "cycle",
        id: cycleId,
        label: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
        dueDate,
        contributionAmount: 5000,
        status: "active",
        participantMemberIds: [],
      },
    });
    return equbId;
  },
});

export const getState = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      state: equbStateValidator,
      importedFromDevice: v.boolean(),
      role: v.union(v.literal("admin"), v.literal("member")),
      memberId: v.union(v.null(), v.string()),
      joinCode: v.union(v.null(), v.string()),
      memberRoles: v.array(v.object({
        memberId: v.string(),
        role: v.union(v.literal("admin"), v.literal("member")),
      })),
    }),
  ),
  handler: async (ctx) => {
    const access = await getAccess(ctx);
    if (!access) return null;
    const stored = await readRecords(ctx, access.equb._id);
    const state = recordsToState(access.equb, stored);
    const memberships = access.role === "admin"
      ? await ctx.db
        .query("memberships")
        .withIndex("by_equb", (q) => q.eq("equbId", access.equb._id))
        .take(MAX_RECORDS.member + 1)
      : [];
    if (memberships.length > MAX_RECORDS.member) {
      throw new ConvexError("This Equb has reached the supported membership limit.");
    }

    if (access.role === "member" && access.memberId) {
      state.members = state.members.filter((member) => member.id === access.memberId);
      state.contributions = state.contributions.filter((payment) => payment.memberId === access.memberId);
      state.cycles = state.cycles.map((cycle) => ({
        ...cycle,
        participantMemberIds: (cycle.participantMemberIds ?? []).filter((id) => id === access.memberId),
      }));
      state.draws = (state.draws ?? []).map((draw) =>
        draw.winnerMemberId !== access.memberId
          ? { ...draw, winnerCustomerNumber: "", winnerIdNumber: "" }
          : draw,
      );
    }

    return {
      state,
      importedFromDevice: access.equb.importedFromDevice,
      role: access.role,
      memberId: access.memberId,
      joinCode: access.role === "admin" ? access.equb.joinCode ?? null : null,
      memberRoles: memberships.map(({ memberId, role }) => ({ memberId, role })),
    };
  },
});

export const importDeviceState = mutation({
  args: { state: equbStateValidator },
  returns: v.null(),
  handler: async (ctx, { state }) => {
    const access = await requireAdmin(ctx);
    const equb = access.equb;
    if (equb.importedFromDevice) throw new ConvexError("This device's data has already been imported.");

    const stored = await readRecords(ctx, equb._id);
    const current = recordsToState(equb, stored);
    if (current.members.length > 0 || current.contributions.length > 0 || current.draws?.length) {
      throw new ConvexError("Cloud data already exists; refusing to overwrite it with a device import.");
    }
    await saveState(ctx, equb, stored, state);
    await ctx.db.patch(equb._id, { importedFromDevice: true });
    return null;
  },
});

export const joinEqub = mutation({
  args: {
    joinCode: v.string(),
    customerNumber: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Sign in is required.");

    const owned = await ctx.db
      .query("equbs")
      .withIndex("by_owner", (q) => q.eq("ownerTokenIdentifier", identity.tokenIdentifier))
      .unique();
    const existingMembership = await ctx.db
      .query("memberships")
      .withIndex("by_token_identifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (owned || existingMembership) throw new ConvexError("This account is already connected to an Equb.");

    const code = args.joinCode.trim().toUpperCase();
    const customerNumber = args.customerNumber.trim();
    if (!code || !customerNumber) {
      throw new ConvexError("Group code and customer number are required.");
    }
    const equb = await ctx.db
      .query("equbs")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .unique();
    if (!equb) throw new ConvexError("The group code or member details are invalid.");

    const memberDocs = await ctx.db
      .query("records")
      .withIndex("by_equb_and_kind", (q) => q.eq("equbId", equb._id).eq("kind", "member"))
      .take(MAX_RECORDS.member + 1);
    if (memberDocs.length > MAX_RECORDS.member) {
      throw new ConvexError("This Equb has reached the supported member record limit.");
    }
    const matches = memberDocs.filter((doc) =>
      doc.record.kind === "member" &&
      doc.record.status === "active" &&
      doc.record.customerNumber?.trim() === customerNumber,
    );
    if (matches.length !== 1 || matches[0].record.kind !== "member") {
      throw new ConvexError("The group code or member details are invalid.");
    }
    const match = matches[0];
    const existingLink = await ctx.db
      .query("memberships")
      .withIndex("by_equb_and_member", (q) => q.eq("equbId", equb._id).eq("memberId", match.record.id))
      .unique();
    if (existingLink) throw new ConvexError("This member already has an account linked.");

    await ctx.db.insert("memberships", {
      equbId: equb._id,
      tokenIdentifier: identity.tokenIdentifier,
      memberId: match.record.id,
      role: "member",
    });
    return null;
  },
});

export const setMemberRole = mutation({
  args: {
    memberId: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  returns: v.null(),
  handler: async (ctx, { memberId, role }) => {
    const access = await requireAdmin(ctx);
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_equb_and_member", (q) => q.eq("equbId", access.equb._id).eq("memberId", memberId))
      .unique();
    if (!membership) throw new ConvexError("This member has not linked an account yet.");
    await ctx.db.patch(membership._id, { role });
    return null;
  },
});

export const rotateJoinCode = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const access = await requireAdmin(ctx);
    const joinCode = await createJoinCode(ctx);
    await ctx.db.patch(access.equb._id, { joinCode });
    return joinCode;
  },
});

export const addMember = mutation({
  args: {
    name: v.string(),
    customerNumber: v.string(),
    idNumber: v.string(),
    phone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const customerNumber = args.customerNumber.trim();
    const idNumber = args.idNumber.trim();
    const phone = args.phone?.trim() ?? "";
    if (!name || !customerNumber || !idNumber) throw new ConvexError("Name, customer number, and ID number are required.");
    await changeState(ctx, (state) => {
      validateMemberIdentity(state, { customerNumber, idNumber });
      if (phone && state.members.some((member) => member.phone.trim() === phone)) {
        throw new ConvexError("A member with this phone number already exists.");
      }
      const memberId = `member-${crypto.randomUUID()}`;
      const member: Member = {
        id: memberId,
        name,
        customerNumber,
        idNumber,
        phone,
        joinedAt: new Date().toISOString(),
        status: "active",
      };
      const activeIds = state.members.filter((item) => item.status === "active").map((item) => item.id);
      return {
        ...state,
        members: [...state.members, member],
        cycles: state.cycles.map((cycle) => cycle.status === "active"
          ? { ...cycle, participantMemberIds: [...(cycle.participantMemberIds ?? activeIds), memberId] }
          : cycle),
      };
    });
    return null;
  },
});

export const updateMember = mutation({
  args: {
    memberId: v.string(),
    name: v.string(),
    customerNumber: v.string(),
    idNumber: v.string(),
    phone: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const customerNumber = args.customerNumber.trim();
    const idNumber = args.idNumber.trim();
    const phone = args.phone?.trim() ?? "";
    if (!name) throw new ConvexError("Member name is required.");
    await changeState(ctx, (state) => {
      if (!state.members.some((member) => member.id === args.memberId)) throw new ConvexError("Member not found.");
      validateMemberIdentity(state, { customerNumber, idNumber }, args.memberId);
      if (phone && state.members.some((member) => member.id !== args.memberId && member.phone.trim() === phone)) {
        throw new ConvexError("A member with this phone number already exists.");
      }
      return {
        ...state,
        members: state.members.map((member) => member.id === args.memberId
          ? { ...member, name, customerNumber, idNumber, phone }
          : member),
      };
    });
    return null;
  },
});

export const recordPayment = mutation({
  args: {
    memberId: v.string(),
    cycleId: v.string(),
    amount: v.number(),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await changeState(
      ctx,
      (state) => recordContribution(state, {
        memberId: args.memberId,
        cycleId: args.cycleId,
        amount: args.amount,
        note: args.note?.trim() || "Entered in app",
      }),
      args.memberId,
    );
    return null;
  },
});

export const verifyPayment = mutation({
  args: { contributionId: v.string(), confirmed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await changeState(ctx, (state) => verifyContribution(state, args.contributionId, args.confirmed));
    return null;
  },
});

export const approvePayoutById = mutation({
  args: { payoutId: v.string() },
  returns: v.null(),
  handler: async (ctx, { payoutId }) => {
    await changeState(ctx, (state) => approvePayout(state, payoutId));
    return null;
  },
});

export const drawWinnerForCycle = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await changeState(ctx, (state) => drawWinner(state));
    return null;
  },
});

export const advanceCycleForEqub = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await changeState(ctx, (state) => advanceCycle(state));
    return null;
  },
});

export const startNextRotationForEqub = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await changeState(ctx, (state) => startNextRotation(state));
    return null;
  },
});
