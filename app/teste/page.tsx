// app/teste/page.tsx
import { listR2Documents } from './teste'; // Ajuste o caminho para onde está sua server action
import DocumentViewer from './DocumentViewer';

export default async function DocumentosPage() {
    // Chama a sua função direto no servidor
    const result = await listR2Documents();

    if (!result.success) {
        return (
            <div className="p-8 max-w-5xl mx-auto">
                <div className="p-4 bg-red-50 text-red-600 rounded-md border border-red-200">
                    {result.error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Arquivos do Cloudflare R2</h1>
                <p className="text-zinc-500 text-sm mt-1">Gerenciamento de documentos armazenados no bucket.</p>
            </div>

            {/* Passa o array de documentos para o componente que roda no cliente */}
            <DocumentViewer documents={result.documents || []} />
        </div>
    );
}