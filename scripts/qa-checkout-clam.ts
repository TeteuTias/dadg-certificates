/**
 * Gera um checkout real de inscricao (Checkout Pro) para testar o fluxo de
 * pagamento ponta a ponta com as credenciais de teste do Mercado Pago.
 *
 *   set -a && . ./.env.local && set +a
 *   npx tsx scripts/qa-checkout-clam.ts <selectionProcessId> [examsCount]
 *
 * Imprime o link de pagamento e o externalReference. Depois de pagar, rode
 * scripts/qa-confirmar-pagamento.ts com esse externalReference.
 */
import mongoose from 'mongoose';
import { ObjectId } from 'bson';
import { connectToDatabase } from '../lib/mongodb';
import { createCheckoutProPaymentForInscription } from '../lib/selective-processes/payment-service';
import {
  getSelectionProcessForStudents,
  getStudentApplicationState,
  resolveTotalPrice,
} from '../lib/selective-processes/services/studentSelectiveProcesses';

const SP = process.argv[2] || '6a92fab72fd46137ff827a87';
const EXAMS_COUNT = Number(process.argv[3] || 2);
// Email do comprador. Nao pode ser o do vendedor: o Mercado Pago bloqueia
// pagamento para a propria conta e o botao de pagar fica desabilitado.
const PAYER_EMAIL = process.argv[4] || 'comprador.teste@testuser.com';
const USER = String(new mongoose.Types.ObjectId());

async function main() {
  await connectToDatabase();

  const proc = await getSelectionProcessForStudents(SP);
  if (!proc) throw new Error('Processo seletivo nao encontrado.');

  const total = resolveTotalPrice(proc.pricingTiers, EXAMS_COUNT);
  if (total === null) throw new Error('Sem faixa de preco cadastrada (PRICING_NOT_CONFIGURED).');

  console.log('usuario de teste :', USER);
  console.log('ligas contratadas:', EXAMS_COUNT);
  console.log('total calculado  :', total);

  const externalReference = String(new ObjectId());
  const result = await createCheckoutProPaymentForInscription({
    usuarioId: USER,
    edicaoId: SP,
    type: 'ticket',
    externalReference,
    items: [
      {
        title: `Inscricao - Processo Seletivo CLAM (${EXAMS_COUNT} liga(s))`,
        quantity: 1,
        unit_price: total,
      },
    ],
    payer: {
      name: 'Candidato Teste',
      cpf: '12345678909',
      zipCode: '38400000',
      street: 'Rua Teste',
      number: '100',
      neighborhood: 'Centro',
      complement: '',
      phone: '34999999999',
      email: PAYER_EMAIL,
    },
    paymentConfig: { examsCount: EXAMS_COUNT, totalAmount: total },
  });

  console.log('\nexternalReference:', externalReference);
  console.log('sessionId        :', result.sessionId);
  console.log('expiresAt        :', result.expiresAt);
  console.log('\nLINK DE PAGAMENTO:\n' + result.init_point);

  const state = await getStudentApplicationState({ selectionProcessId: SP, userId: USER });
  console.log('\nstatus do candidato:', state!.status);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('ERRO:', error);
  await mongoose.disconnect();
  process.exit(1);
});
