import { Paperclip } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getPaymentAttachmentDownloadUrl,
  getPaymentAttachmentPreviewUrl,
  hasPaymentAttachment,
} from "@/lib/paymentAttachments";
import type { ShipmentPayment } from "@shared/schema";

interface PaymentAttachmentIconProps {
  paymentId: number | null | undefined;
  attachmentUrl: ShipmentPayment["attachmentUrl"];
  attachmentOriginalName?: ShipmentPayment["attachmentOriginalName"] | null;
  className?: string;
}

export function PaymentAttachmentIcon({
  paymentId,
  attachmentUrl,
  attachmentOriginalName,
  className,
}: PaymentAttachmentIconProps) {
  if (!paymentId || !hasPaymentAttachment({ attachmentUrl })) {
    return null;
  }

  const previewUrl = getPaymentAttachmentPreviewUrl(paymentId);
  const downloadUrl = `${getPaymentAttachmentDownloadUrl(paymentId)}?download=1`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={downloadUrl}
          download={attachmentOriginalName || undefined}
          className={cn("inline-flex items-center justify-center", className)}
          data-testid={`payment-attachment-${paymentId}`}
          aria-label="تحميل صورة المرفق"
        >
          <Paperclip className="h-4 w-4 text-muted-foreground" />
        </a>
      </TooltipTrigger>
      <TooltipContent className="p-2" side="top">
        <div className="flex flex-col items-center gap-2">
          <img
            src={previewUrl}
            alt="معاينة المرفق"
            className="h-24 w-24 rounded border object-cover"
            loading="lazy"
          />
          <span className="text-xs text-muted-foreground">انقر للتحميل</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
