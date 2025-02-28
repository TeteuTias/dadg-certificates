"use client"
import React from 'react';
// a diferenca e que esse aceita varios parametros, diferente do outro!!
export interface IModalProps {
    title: string;
    emoji: string;
    text: string;
    buttons: Array<{ label: string, action: () => void, styleButton?: React.CSSProperties }>;
}

const ModalAction: React.FC<IModalProps> = ({ title, text, buttons, emoji }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FEFAE0] bg-opacity-75">
            <div className="max-w-[95%] md:max-w-md w-full bg-white">
                <div className="flex flex-row content-center p-2 border-[2.8px] border-[#283618] ">
                    <div className='ml-2 flex flex-row space-x-1'>
                        <p className="text-xl font-bold text-black">{emoji}</p>
                        <p className="text-xl font-bold text-black">{title}</p>
                    </div>
                </div>
                <div className=" border-[2.8px] border-[#283618] border-t-[0px]  p-5">
                    <p className="mb-6 text-left ">{text}</p>
                    <div className="flex justify-start space-x-4">
                        {buttons.map((button, index) => (
                            <button
                                key={index}
                                onClick={button.action}
                                style={button.styleButton}
                                className="bg-red-500 text-black px-4 py-2 hover:bg-red-600 border-[2.5px] border-black"
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
