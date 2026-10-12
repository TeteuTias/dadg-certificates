import type { ReactNode } from "react";
import "./clam-admin.css";

export default function SelectiveProcessesLayout({ children }: { children: ReactNode }) {
  return <div className="clam-admin-area">{children}</div>;
}
