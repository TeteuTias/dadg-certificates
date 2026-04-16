import { Poppins } from "next/font/google";

export const PoppinsFontLib = Poppins({
    weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    style: ['normal', 'italic'],
    subsets: ['latin', 'latin-ext'],
})