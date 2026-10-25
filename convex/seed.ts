import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const samplePeople = [
  { name: "Abebe Kebede", phone: "0911234567" },
  { name: "Almaz Tefera", phone: "0912345678" },
  { name: "Dawit Alemu", phone: "0913456789" },
  { name: "Selamawit Bekele", phone: "0914567890" },
  { name: "Yohannes Tadesse", phone: "0915678901" },
  { name: "Mekdes Girma", phone: "0916789012" },
  { name: "Bereket Worku", phone: "0917890123" },
  { name: "Rahel Getachew", phone: "0918901234" },
  { name: "Samuel Assefa", phone: "0920123456" },
  { name: "Liya Demissie", phone: "0921234567" },
  { name: "Henok Fikru", phone: "0922345678" },
  { name: "Bethlehem Tola", phone: "0923456789" },
  { name: "Tewodros Belay", phone: "0924567890" },
  { name: "Meron Nigatu", phone: "0925678901" },
  { name: "Fitsum Kebede", phone: "0926789012" },
  { name: "Hirut Desta", phone: "0927890123" },
  { name: "Natnael Bekele", phone: "0928901234" },
  { name: "Kalkidan Fenta", phone: "0930123456" },
  { name: "Robel Alemayehu", phone: "0931234567" },
  { name: "Tigist Worku", phone: "0932345678" },
];

export const seedSampleMembers = mutation({
  args: {
    equbId: v.optional(v.id("equbs")),
  },
  returns: v.object({
    equbId: v.id("equbs"),
    groupName: v.string(),
    addedCount: v.number(),
    totalMembers: v.number(),
  }),
  handler: async (ctx, args) => {
    let equb: Doc<"equbs"> | null = null;
    if (args.equbId) {
      equb = await ctx.db.get(args.equbId);
    }
    if (!equb) {
      // Look for any existing equb in the database
      const existingEqubs = await ctx.db.query("equbs").take(1);
      if (existingEqubs.length > 0) {
        equb = existingEqubs[0];
      }
    }

    if (!equb) {
      // Create a default equb if none exists
      const now = new Date();
      const cycleId = `cycle-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const dueDate = new Date(now.getFullYear(), now.getMonth(), 25).toISOString();
      const newEqubId = await ctx.db.insert("equbs", {
        ownerTokenIdentifier: "system_seed",
        joinCode: "EQUB2026",
        groupName: "የእኩብ ማህበር (Sample Equb)",
        currency: "ETB",
        contributionAmount: 5000,
        frequency: "monthly",
        currentRotation: 1,
        importedFromDevice: false,
      });
      await ctx.db.insert("records", {
        equbId: newEqubId,
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
      equb = (await ctx.db.get(newEqubId))!;
    }

    const equbId: Id<"equbs"> = equb._id;

    // Fetch existing records for this equb
    const existingRecords = await ctx.db
      .query("records")
      .withIndex("by_equb_and_kind", (q) => q.eq("equbId", equbId))
      .take(1000);

    const existingMemberDocs = existingRecords.filter((r) => r.kind === "member");
    const existingPhones = new Set(
      existingMemberDocs.map((r) => (r.record.kind === "member" ? r.record.phone : ""))
    );
    const existingCustomerNumbers = new Set(
      existingMemberDocs.map((r) => (r.record.kind === "member" ? r.record.customerNumber : ""))
    );

    let nextPosition = existingMemberDocs.length;
    let addedCount = 0;
    const newMemberIds: string[] = [];

    const now = new Date();
    for (let i = 0; i < samplePeople.length; i++) {
      const person = samplePeople[i];
      if (existingPhones.has(person.phone)) {
        continue;
      }

      const seq = existingMemberDocs.length + addedCount + 1;
      const customerNumber = `EQ-${String(seq).padStart(4, "0")}`;
      const idNumber = `ET-ID-${String(seq).padStart(4, "0")}`;
      const memberId = `member-seed-${Date.now()}-${seq}`;

      await ctx.db.insert("records", {
        equbId,
        kind: "member",
        position: nextPosition++,
        record: {
          kind: "member",
          id: memberId,
          name: person.name,
          customerNumber,
          idNumber,
          phone: person.phone,
          joinedAt: new Date(now.getTime() - i * 86400000).toISOString(),
          status: "active",
        },
      });

      newMemberIds.push(memberId);
      addedCount++;
    }

    // Add new members to the active cycle's participants
    const cycleDoc = existingRecords.find((r) => r.kind === "cycle" && r.record.kind === "cycle" && r.record.status === "active");
    if (cycleDoc && cycleDoc.record.kind === "cycle" && newMemberIds.length > 0) {
      const currentParticipants = cycleDoc.record.participantMemberIds ?? [];
      const updatedParticipants = Array.from(new Set([...currentParticipants, ...newMemberIds]));
      await ctx.db.patch(cycleDoc._id, {
        record: {
          ...cycleDoc.record,
          participantMemberIds: updatedParticipants,
        },
      });
    }

    return {
      equbId,
      groupName: equb.groupName,
      addedCount,
      totalMembers: existingMemberDocs.length + addedCount,
    };
  },
});
