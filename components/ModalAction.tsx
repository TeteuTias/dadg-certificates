"use client";

import React from "react";
import { AlertTriangle, BadgeCheck, Info } from "lucide-react";
import "./ModalAction.css";

export interface IModalProps {
    title: string;
    emoji: string;
    text: string;
    buttons: Array<{ label: string; action: () => void; styleButton?: React.CSSProperties }>;
}

type ModalTone = "success" | "danger" | "info";

const getToneFromContent = (title: string, text: string): ModalTone => {
    const normalized = `${title} ${text}`.toLowerCase();

    if (normalized.includes("erro") || normalized.includes("falha")) {
        return "danger";
    }

    if (
        normalized.includes("sucesso") ||
        normalized.includes("criado") ||
        normalized.includes("adicionado") ||
        normalized.includes("obrigado")
    ) {
        return "success";
    }

    return "info";
};

const toneIconMap: Record<ModalTone, React.ReactNode> = {
    success: <BadgeCheck size={22} />,
    danger: <AlertTriangle size={22} />,
    info: <Info size={22} />,
};

const toneLabelMap: Record<ModalTone, string> = {
    success: "Tudo certo",
    danger: "Revisao necessaria",
    info: "Confirme a acao",
};

const ModalAction: React.FC<IModalProps> = ({ title, text, buttons, emoji }) => {
    const tone = getToneFromContent(title, text);

    return (
        <div className="modal-action-overlay">
            <div className={`modal-action-card tone-${tone}`}>
                <div className="modal-action-header">
                    <div className="modal-action-icon-wrap">
                        {emoji ? <span className="modal-action-emoji">{emoji}</span> : toneIconMap[tone]}
                    </div>

                    <div className="modal-action-heading">
                        <span className="modal-action-eyebrow">{toneLabelMap[tone]}</span>
                        <h2>{title}</h2>
                    </div>
                </div>

                <div className="modal-action-body">
                    <p className="modal-action-text">{text}</p>

                    <div className="modal-action-buttons">
                        {buttons.map((button, index) => (
                            <button
                                key={`${button.label}-${index}`}
                                onClick={button.action}
                                style={button.styleButton}
                                className={`modal-action-button ${index === 0 ? "is-primary" : "is-secondary"}`}
                            >
                                {button.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalAction;
