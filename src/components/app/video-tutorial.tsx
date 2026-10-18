"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { VIDEO_TUTORIAL } from "@/config/guias";

export type VideoTutorialDados = { url: string; poster?: string | null };

// Vídeo-tutorial de quem apresenta emendas, numa janela: a visão geral do
// sistema em pouco mais de três minutos. Abre sozinho na primeira entrada e
// volta por "Ver ajuda › Vídeo" ou por Minha conta. Fechar, por qualquer
// caminho, conta como visto.
export function VideoTutorial({ video, aberto, aoFechar }: { video: VideoTutorialDados; aberto: boolean; aoFechar: () => void }) {
  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => {
        if (!o) aoFechar();
      }}
    >
      {aberto ? (
        <DialogContent
          titulo={VIDEO_TUTORIAL.titulo}
          largura="xl"
          aviso="Em pouco mais de três minutos: a tela inicial, as três etapas da emenda, o acompanhamento e a sua cota. Dá para pausar e rever quando quiser."
          acoes={<Button onClick={aoFechar}>Começar a usar</Button>}
        >
          <video
            controls
            playsInline
            preload="metadata"
            poster={video.poster ?? undefined}
            src={video.url}
            aria-label="Vídeo-tutorial: como usar o Emendas360 como vereador"
            className="aspect-video w-full rounded-md bg-navy-deep"
          />
          <p className="mt-3 text-sm text-muted-foreground">Para assistir de novo, use “Ver ajuda › Vídeo: como usar” no menu, ou abra Minha conta.</p>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
