/**
 * Teste de integracao do fluxo de inscricao no processo seletivo.
 *
 * Roda contra o banco configurado em .env.local, usando um usuario ficticio, e
 * apaga tudo o que cria no final. Use com o id de um processo seletivo real:
 *
 *   set -a && . ./.env.local && set +a && npx tsx scripts/qa-inscricao-clam.ts <selectionProcessId>
 */
import mongoose from 'mongoose';
import { connectToDatabase } from '../lib/mongodb';
import {
  getSelectionProcessForStudents,
  getStudentApplicationState,
  resolveTotalPrice,
  selectLeaguesForApplication,
  LeagueSelectionError,
} from '../lib/selective-processes/services/studentSelectiveProcesses';
import {
  confirmEnrollmentForPaymentSession,
  resolvePaymentSessionId,
} from '../lib/selective-processes/services/enrollment';
import { PaymentSession } from '../lib/selective-processes/models/PaymentSessionModel';
import { Application } from '../lib/selective-processes/models/ApplicationModel';
import { Ticket } from '../lib/selective-processes/models/TicketModel';
import { ApplicationLeagueSelection } from '../lib/selective-processes/models/ApplicationLeagueSelectionModel';

const SP = process.argv[2] || '6a92fab72fd46137ff827a87';
const USER = new mongoose.Types.ObjectId();
let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail = '') {
  console.log((ok ? 'PASS   ' : 'FALHOU ') + label + (detail ? ' -> ' + detail : ''));
  if (ok) pass++;
  else fail++;
}

async function main() {
  await connectToDatabase();
  console.log('Usuario de teste: ' + String(USER));

  console.log('\n--- PRECO ---');
  const proc = await getSelectionProcessForStudents(SP);
  const tiers = proc!.pricingTiers;
  check('1 liga = R$50', resolveTotalPrice(tiers, 1) === 50, String(resolveTotalPrice(tiers, 1)));
  check('2 ligas = R$90', resolveTotalPrice(tiers, 2) === 90, String(resolveTotalPrice(tiers, 2)));
  check('3 ligas = R$120', resolveTotalPrice(tiers, 3) === 120, String(resolveTotalPrice(tiers, 3)));
  check('5 ligas usa fallback linear', resolveTotalPrice(tiers, 5) === 250, String(resolveTotalPrice(tiers, 5)));

  console.log('\n--- ESTADO INICIAL ---');
  let state = await getStudentApplicationState({ selectionProcessId: SP, userId: String(USER) });
  check('status NOT_REGISTERED', state!.status === 'NOT_REGISTERED', state!.status);
  check('canCheckout true', state!.canCheckout === true);
  check('canSelectLeagues false', state!.canSelectLeagues === false);

  console.log('\n--- ESCOLHER LIGA SEM PAGAR ---');
  try {
    await selectLeaguesForApplication({
      selectionProcessId: SP,
      userId: String(USER),
      examIds: [proc!.exams[0].id],
    });
    check('bloqueia sem pagamento', false, 'nao bloqueou');
  } catch (error) {
    check(
      'bloqueia sem pagamento',
      error instanceof LeagueSelectionError && error.code === 'APPLICATION_NOT_FOUND',
      (error as Error).message,
    );
  }

  console.log('\n--- SIMULANDO PAGAMENTO APROVADO (2 ligas) ---');
  const externalReference = String(new mongoose.Types.ObjectId());
  const created = await PaymentSession.create([
    {
      orderId: externalReference,
      owner: USER,
      edicaoId: SP,
      userProps: {
        name: 'Teste QA',
        cpf: '12345678909',
        zipCode: '38400000',
        street: 'Rua Teste',
        number: '1',
        neighborhood: 'Centro',
        complement: '',
        phone: '34999999999',
        email: 'qa@dadg.test',
      },
      paymentConfig: { examsCount: 2, totalAmount: 90 },
      type: 'ticket',
      status: 'PENDING',
      paymentUrl: 'https://mp.test/checkout',
      expiresAt: new Date(Date.now() + 900000),
    },
  ]);
  const session = created[0];

  const resolved = await resolvePaymentSessionId(externalReference);
  check(
    'webhook acha a sessao pelo external_reference',
    String(resolved) === String(session._id),
    String(resolved),
  );

  const enrolled = await confirmEnrollmentForPaymentSession(resolved!);
  check('inscricao efetivada com 2 creditos', enrolled?.leagueAllowanceCount === 2, JSON.stringify(enrolled));

  const again = await confirmEnrollmentForPaymentSession(resolved!);
  const appCount = await Application.countDocuments({
    selectionProcessId: new mongoose.Types.ObjectId(SP),
    userId: USER,
  });
  check(
    'webhook reentregue nao duplica',
    appCount === 1 && again?.applicationId === enrolled?.applicationId,
    'applications=' + appCount,
  );

  state = await getStudentApplicationState({ selectionProcessId: SP, userId: String(USER) });
  check('status PAID_PENDING_LEAGUES', state!.status === 'PAID_PENDING_LEAGUES', state!.status);
  check('canSelectLeagues true', state!.canSelectLeagues === true);
  check('restam 2 escolhas', state!.remainingSelections === 2, String(state!.remainingSelections));

  console.log('\n--- ESCOLHA DE LIGAS ---');
  try {
    await selectLeaguesForApplication({
      selectionProcessId: SP,
      userId: String(USER),
      examIds: [proc!.exams[0].id, proc!.exams[1].id, proc!.exams[2].id],
    });
    check('bloqueia escolher mais do que pagou', false, 'nao bloqueou');
  } catch (error) {
    check(
      'bloqueia escolher mais do que pagou',
      (error as LeagueSelectionError).code === 'LEAGUE_ALLOWANCE_EXCEEDED',
      (error as Error).message,
    );
  }

  try {
    await selectLeaguesForApplication({
      selectionProcessId: SP,
      userId: String(USER),
      examIds: ['000000000000000000000000'],
    });
    check('bloqueia liga fora do processo', false, 'nao bloqueou');
  } catch (error) {
    check(
      'bloqueia liga fora do processo',
      (error as LeagueSelectionError).code === 'EXAMS_INVALID_FOR_PROCESS',
      (error as Error).message,
    );
  }

  state = await selectLeaguesForApplication({
    selectionProcessId: SP,
    userId: String(USER),
    examIds: [proc!.exams[0].id],
  });
  check('1a liga registrada', state!.selectedExamIds.length === 1, JSON.stringify(state!.selectedExamIds));
  check('resta 1 escolha', state!.remainingSelections === 1, String(state!.remainingSelections));

  try {
    await selectLeaguesForApplication({
      selectionProcessId: SP,
      userId: String(USER),
      examIds: [proc!.exams[0].id],
    });
    check('bloqueia repetir liga travada', false, 'nao bloqueou');
  } catch (error) {
    check(
      'bloqueia repetir liga travada',
      (error as LeagueSelectionError).code === 'LEAGUES_ALREADY_SELECTED',
      (error as Error).message,
    );
  }

  state = await selectLeaguesForApplication({
    selectionProcessId: SP,
    userId: String(USER),
    examIds: [proc!.exams[1].id],
  });
  check('2a liga registrada', state!.selectedExamIds.length === 2, JSON.stringify(state!.selectedExamIds));
  check('status ENROLLED', state!.status === 'ENROLLED', state!.status);
  check('canSelectLeagues false apos completar', state!.canSelectLeagues === false);
  check('canCheckout false (nao paga de novo)', state!.canCheckout === false);

  try {
    await selectLeaguesForApplication({
      selectionProcessId: SP,
      userId: String(USER),
      examIds: [proc!.exams[2].id],
    });
    check('bloqueia 3a liga sem credito', false, 'nao bloqueou');
  } catch (error) {
    check(
      'bloqueia 3a liga sem credito',
      (error as LeagueSelectionError).code === 'LEAGUE_ALLOWANCE_EXCEEDED',
      (error as Error).message,
    );
  }

  console.log('\n--- VAGAS ---');
  const after = await getSelectionProcessForStudents(SP);
  check('vaga contabilizada apos pagamento', after!.paidCount === 1, 'paidCount=' + after!.paidCount);

  console.log('\n--- LIMPEZA ---');
  const app = await Application.findOne({
    selectionProcessId: new mongoose.Types.ObjectId(SP),
    userId: USER,
  });
  await ApplicationLeagueSelection.deleteMany({ applicationId: app!._id });
  await Ticket.deleteMany({ applicationId: app!._id });
  await Application.deleteOne({ _id: app!._id });
  await PaymentSession.deleteOne({ _id: session._id });
  const leftovers =
    (await Application.countDocuments({ userId: USER })) +
    (await PaymentSession.countDocuments({ owner: USER }));
  check('dados de teste removidos', leftovers === 0, 'restaram ' + leftovers);

  console.log('\nRESULTADO: ' + pass + ' passaram, ' + fail + ' falharam');
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch(async (error) => {
  console.error('ERRO FATAL:', error);
  await mongoose.disconnect();
  process.exit(1);
});
