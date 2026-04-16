"use client";

import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import "./ModalAction.css";

export interface IModalProps {
    title: string;
    emoji: string;
    text: string;
    expectedPhrase: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

const ModalActionWithTextVerification: React.FC<IModalProps> = ({
    title,
    text,
    emoji,
    expectedPhrase,
    onConfirm,
    onCancel,
}) => {
    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState("");

    const handleConfirm = () => {
        if (inputValue === expectedPhrase) {
            onConfirm();
            return;
        }

        setError("Digite a frase exatamente como pedido.");
    };

    return (
        <div className="modal-action-overlay">
            <div className="modal-action-card tone-info">
                <div className="modal-action-header">
                    <div className="modal-action-icon-wrap">
                        {emoji ? <span className="modal-action-emoji">{emoji}</span> : <ShieldCheck size={22} />}
                    </div>

                    <div className="modal-action-heading">
                        <span className="modal-action-eyebrow">Confirmacao adicional</span>
                        <h2>{title}</h2>
                    </div>
                </div>

                <div className="modal-action-body">
                    <p className="modal-action-text">{text}</p>
                    <p className="modal-action-note">
                        Para continuar, digite exatamente: <strong>{expectedPhrase}</strong>
                    </p>

                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                            setInputValue(e.target.value);
                            if (error) {
                                setError("");
                            }
                        }}
                        placeholder="Digite a frase exatamente como pedido"
                        className="modal-action-input"
                    />

                    {error && <p className="modal-action-error">{error}</p>}

                    <div className="modal-action-buttons">
                        {onCancel && (
                            <button onClick={onCancel} className="modal-action-button is-secondary">
                                Cancelar
                            </button>
                        )}

                        <button onClick={handleConfirm} className="modal-action-button is-primary">
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalActionWithTextVerification;
