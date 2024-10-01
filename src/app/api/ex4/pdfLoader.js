import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

const loader = new PDFLoader("./src/app/api/ex4/Tarea5.pdf");

const docs = await loader.load();

export default docs;