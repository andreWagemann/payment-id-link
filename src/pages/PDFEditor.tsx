import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Copy, Download, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";

interface TextElement {
  id: string;
  label: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export default function PDFEditor() {
  const [elements, setElements] = useState<TextElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pdfHeight, setPdfHeight] = useState(842); // A4 height in points
  const [pdfWidth, setPdfWidth] = useState(595);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Set up PDF.js worker from node_modules
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    
    // Load default PDF
    loadPDFFromUrl("/contract-template.pdf");
  }, []);

  const loadPDFFromUrl = async (url: string) => {
    try {
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 1.0 });
      setPdfHeight(Math.round(viewport.height));
      setPdfWidth(Math.round(viewport.width));
      
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;
      
      const context = canvas.getContext("2d");
      if (!context) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      }).promise;
      
      setBackgroundImage(canvas.toDataURL());
      toast.success("PDF template loaded!");
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF template");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 1.0 });
      setPdfHeight(Math.round(viewport.height));
      setPdfWidth(Math.round(viewport.width));
      
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;
      
      const context = canvas.getContext("2d");
      if (!context) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      }).promise;
      
      setBackgroundImage(canvas.toDataURL());
      toast.success("Custom PDF loaded!");
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast.error("Failed to load PDF");
    }
  };

  const addElement = () => {
    const newElement: TextElement = {
      id: Date.now().toString(),
      label: `Element ${elements.length + 1}`,
      x: 50,
      y: 100,
      text: "Sample Text",
      fontSize: 9,
    };
    setElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  const updateElement = (id: string, updates: Partial<TextElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const element = elements.find(el => el.id === id);
    if (!element) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragOffset({
      x: e.clientX - rect.left - element.x,
      y: e.clientY - rect.top - element.y,
    });
    setSelectedId(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectedId) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left - dragOffset.x));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top - dragOffset.y));

    updateElement(selectedId, { x: Math.round(x), y: Math.round(y) });
  };

  const handleMouseUp = () => {
    setSelectedId(null);
  };

  const copyCoordinates = (element: TextElement) => {
    const pdfY = pdfHeight - element.y;
    const code = `page.drawText("${element.text}", { x: ${element.x}, y: height - ${element.y}, size: ${element.fontSize}, font });`;
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard!");
  };

  const exportAllCoordinates = () => {
    const code = elements.map(el => {
      const pdfY = pdfHeight - el.y;
      return `// ${el.label}\npage.drawText("${el.text}", { x: ${el.x}, y: height - ${el.y}, size: ${el.fontSize}, font });`;
    }).join("\n\n");
    
    navigator.clipboard.writeText(code);
    toast.success("All coordinates copied!");
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">PDF Position Editor</h1>
          <div className="flex gap-2">
            <Button onClick={addElement}>Add Element</Button>
            <Button onClick={exportAllCoordinates} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export All
            </Button>
            <label>
              <Button variant="outline" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload PDF
                </span>
              </Button>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>
        
        <canvas ref={pdfCanvasRef} className="hidden" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Canvas Area */}
          <div className="lg:col-span-2">
            <Card className="p-4">
              <div className="mb-4">
                <Label>PDF Height (points)</Label>
                <Input
                  type="number"
                  value={pdfHeight}
                  onChange={(e) => setPdfHeight(Number(e.target.value))}
                  className="w-32"
                />
              </div>
              
              <div
                ref={canvasRef}
                className="relative bg-white border-2 border-gray-300 shadow-lg overflow-hidden"
                style={{ width: `${pdfWidth}px`, height: `${pdfHeight}px` }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* PDF Background */}
                {backgroundImage && (
                  <img
                    src={backgroundImage}
                    alt="PDF Template"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />
                )}
                {/* Grid lines */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  {Array.from({ length: Math.floor(pdfHeight / 50) }).map((_, i) => (
                    <div
                      key={`h-${i}`}
                      className="absolute w-full border-t border-gray-300"
                      style={{ top: `${i * 50}px` }}
                    />
                  ))}
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={`v-${i}`}
                      className="absolute h-full border-l border-gray-300"
                      style={{ left: `${i * 50}px` }}
                    />
                  ))}
                </div>

                {/* Text Elements */}
                {elements.map((element) => (
                  <div
                    key={element.id}
                    className={`absolute cursor-move select-none ${
                      selectedId === element.id ? "ring-2 ring-primary" : ""
                    }`}
                    style={{
                      left: `${element.x}px`,
                      top: `${element.y}px`,
                      fontSize: `${element.fontSize}px`,
                      fontFamily: "Helvetica, Arial, sans-serif",
                    }}
                    onMouseDown={(e) => handleMouseDown(e, element.id)}
                  >
                    <div className="bg-yellow-100 bg-opacity-50 px-1 rounded">
                      {element.text}
                    </div>
                    <div className="text-[8px] text-gray-500 whitespace-nowrap">
                      x:{element.x} y:{element.y} (PDF: {pdfHeight - element.y})
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Properties Panel */}
          <div className="space-y-4">
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-4">Elements</h2>
              <div className="space-y-2">
                {elements.map((el) => (
                  <div
                    key={el.id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                      selectedId === el.id ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedId(el.id)}
                  >
                    <span className="text-sm truncate">{el.label}</span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyCoordinates(el);
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteElement(el.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {selectedElement && (
              <Card className="p-4">
                <h2 className="text-lg font-semibold mb-4">Properties</h2>
                <div className="space-y-4">
                  <div>
                    <Label>Label</Label>
                    <Input
                      value={selectedElement.label}
                      onChange={(e) => updateElement(selectedElement.id, { label: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label>Text</Label>
                    <Input
                      value={selectedElement.text}
                      onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>X</Label>
                      <Input
                        type="number"
                        value={selectedElement.x}
                        onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Y (Screen)</Label>
                      <Input
                        type="number"
                        value={selectedElement.y}
                        onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>PDF Y (height - y)</Label>
                    <Input
                      type="number"
                      value={pdfHeight - selectedElement.y}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div>
                    <Label>Font Size</Label>
                    <Input
                      type="number"
                      value={selectedElement.fontSize}
                      onChange={(e) => updateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                    />
                  </div>

                  <Button
                    onClick={() => copyCoordinates(selectedElement)}
                    className="w-full"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
