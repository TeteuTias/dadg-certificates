import { clamFailure } from '@/lib/selective-processes/errors';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import GateKeeper from '@/lib/security/gatekeeper';
import { replacePricingTiers } from '@/lib/selective-processes/services/selectiveProcesses';
import { PricingTier } from '@/lib/selective-processes/models/PricingTierModel';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Faixas de preço por quantidade de ligas.
 * O checkout do candidato calcula o valor a partir daqui, então sem pelo menos
 * uma faixa cadastrada as inscrições ficam bloqueadas.
 */
export async function GET(request: NextRequest, { params }: Context) {
  try {

  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 },
    );
  }

  const { id } = await params;
  await connectToDatabase();

  const tiers = (await PricingTier.find({ selectionProcessId: id })
    .sort({ examsCount: 1 })
    .lean()) as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    examsCount: number;
    unitTotalPrice: number;
  }>;

  return NextResponse.json({
    success: true,
    data: tiers.map((tier) => ({
      id: String(tier._id),
      examsCount: tier.examsCount,
      unitTotalPrice: tier.unitTotalPrice,
    })),
  });

  } catch (error) { return clamFailure(error); }
}

/** Substitui a tabela inteira de preços do processo seletivo. */
export async function PUT(request: NextRequest, { params }: Context) {
  try {

  const access = await new GateKeeper(request).validate();
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message, code: access.code },
      { status: access.status || 403 },
    );
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'INVALID_ID' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const tiers = body?.pricingTiers;

  if (!Array.isArray(tiers) || tiers.length === 0) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const parsed = tiers.map((tier) => ({
    examsCount: Number((tier as { examsCount?: unknown }).examsCount),
    unitTotalPrice: Number((tier as { unitTotalPrice?: unknown }).unitTotalPrice),
  }));

  const invalid = parsed.some(
    (tier) =>
      !Number.isInteger(tier.examsCount) ||
      tier.examsCount < 1 || tier.examsCount > 4 ||
      !Number.isFinite(tier.unitTotalPrice) ||
      tier.unitTotalPrice <= 0,
  );
  if (invalid) {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  if (new Set(parsed.map((tier) => tier.examsCount)).size !== parsed.length) {
    return NextResponse.json({ success: false, error: 'DUPLICATED_EXAMS_COUNT' }, { status: 400 });
  }

  await connectToDatabase();

  await replacePricingTiers(id, parsed);

  return NextResponse.json({ success: true, data: parsed });

  } catch (error) { return clamFailure(error); }
}
