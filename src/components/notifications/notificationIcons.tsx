import {
  FolderPlus,
  UserPlus,
  ArrowRightLeft,
  Video,
  Clock,
  AlertCircle,
  MessageSquare,
  Reply,
  FileWarning,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  AlertTriangle,
  DollarSign,
  CreditCard,
  Mail,
  RefreshCw,
  Shield,
  AtSign,
} from "lucide-react";
import { NotificationType } from "@/lib/notifications";

export function getNotificationIcon(type: NotificationType) {
  const iconMap: Record<NotificationType, any> = {
    project_created: FolderPlus,
    project_assigned: UserPlus,
    project_status_changed: ArrowRightLeft,
    version_added: Video,
    deadline_approaching: Clock,
    deadline_overdue: AlertCircle,
    feedback_added: MessageSquare,
    feedback_replied: Reply,
    correction_requested: FileWarning,
    project_approved: CheckCircle,
    project_rejected: XCircle,
    invoice_generated: FileText,
    invoice_due: Calendar,
    invoice_overdue: AlertTriangle,
    payment_received: DollarSign,
    payment_failed: CreditCard,
    chat_message: Mail,
    subscription_expiring: Clock,
    subscription_renewed: RefreshCw,
    system_alert: Shield,
    user_mentioned: AtSign,
  };

  return iconMap[type] || MessageSquare;
}
