"use client"
import { useState } from 'react'

export default function Home() {
    const [isRed, setIsRed] = useState(true)

    const toggleDiv = () => {
        setIsRed(!isRed)
    }

    return (
        <div className="flex justify-center items-center h-screen w-screen">
            <div className={`flex justify-center items-center h-full w-full ${isRed ? 'bg-red-500' : 'bg-blue-500'} transition-all`}>
                <div className="text-center">
                    <h1 className="text-6xl text-white mb-6">{isRed ? 'Silvio' : 'Mateus'}</h1>
                    <button
                        onClick={toggleDiv}
                        className="px-6 py-2 bg-white text-black rounded-lg shadow-md hover:bg-gray-300"
                    >
                        Trocar
                    </button>
                </div>
            </div>
        </div>
    )
}