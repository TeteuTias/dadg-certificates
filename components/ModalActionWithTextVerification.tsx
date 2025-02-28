"use client"
import React, { useState } from 'react';

export interface IModalProps {
    title: string;
    emoji: string;
    text: string;
    expectedPhrase: string; // frase que o usuário deve digitar exatamente
    onConfirm: () => void;  // função a ser executada se a frase estiver correta
    onCancel?: () => void;  // ação opcional para cancelar
}

const ModalActionWithTextVerification
    : React.FC<IModalProps> = ({
        title,
        text,
        emoji,
        expectedPhrase,
        onConfirm,
        onCancel,
    }) => {
        const [inputValue, setInputValue] = useState('');
        const [error, setError] = useState('');

        const handleConfirm = () => {
            if (inputValue === expectedPhrase) {
                onConfirm();
            } else {
                setError('Digite a frase exatamente como pedido.');
            }
        };

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FEFAE0] bg-opacity-75">
                <div className="max-w-[95%] md:max-w-md w-full bg-white">
                    <div className="flex flex-row items-center p-2 border-[2.8px] border-[#283618]">
                        <div className="ml-2 flex flex-row space-x-1">
                            <p className="text-xl font-bold text-black">{emoji}</p>
                            <p className="text-xl font-bold text-black">{title}</p>
                        </div>
                    </div>
                    <div className="border-[2.8px] border-[#283618] border-t-0 p-5">
                        <p className="">{text}</p>
                        <p className="mb-6"><span className='font-extrabold text-gray-700'>Para continuar, digite a seguinte frase: </span>{expectedPhrase}</p>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder="Digite a frase exatamente como pedido"
                            className="w-full p-2 mb-4 border border-gray-300"
                        />
                        {error && <p className="text-red-500 mb-4">{error}</p>}
                        <div className="flex justify-end space-x-4">
                            {onCancel && (
                                <button
                                    onClick={onCancel}
                                    className="bg-gray-300 text-black px-4 py-2 hover:bg-gray-400 border border-black"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                onClick={handleConfirm}
                                className="bg-red-500 text-black px-4 py-2 hover:bg-red-600 border border-black"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

export default ModalActionWithTextVerification
    ;
