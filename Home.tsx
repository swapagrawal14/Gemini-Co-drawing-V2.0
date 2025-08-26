/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import {Content, GoogleGenAI, Modality} from '@google/genai';
import {
  ChevronDown,
  Download,
  KeyRound,
  LoaderCircle,
  Redo2,
  SendHorizontal,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';

// ErrorDisplay component to provide contextual help for API errors
const ErrorDisplay = ({message}: {message: string}) => {
  const isQuotaError = /quota/i.test(message);
  const isApiKeyError = /API key not valid/i.test(message);
  const isHostError = /origin is not allowed/i.test(message);

  // A more robust way to parse Google API errors
  const parseGoogleError = (msg: string) => {
    // Example error: [GoogleGenerativeAI Error]: [400] API key not valid. Please pass a valid API key.
    const match = msg.match(/\[GoogleGenerativeAI Error\]: (.*)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    // Fallback for other formats
    try {
      const errorObj = JSON.parse(msg);
      return errorObj.error?.message || msg;
    } catch (e) {
      // Not a JSON string, return as is
      return msg;
    }
  };

  const friendlyMessage = parseGoogleError(message);

  return (
    <>
      <p className="font-medium text-gray-600 mb-4">{friendlyMessage}</p>
      {(isQuotaError || isHostError) && (
        <div className="text-sm text-gray-500 bg-yellow-50 p-3 rounded-md border border-yellow-200">
          <p className="font-bold mb-1">Seeing a permission or quota error?</p>
          <p className="mb-2">
            This can happen for a few reasons, even with a new API key:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>API key restrictions:</strong> Your key may be restricted.
              Make sure it has no "HTTP referrer" restrictions, or that it
              explicitly allows requests from{' '}
              <code className="bg-gray-200 p-1 rounded text-xs">
                {window.location.hostname}
              </code>
              .
            </li>
            <li>
              <strong>Billing account:</strong> Ensure a billing account is
              linked to your Google Cloud project to avoid strict free-tier
              limits.
            </li>
          </ul>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline mt-2 block font-medium">
            Check your API Key settings &rarr;
          </a>
        </div>
      )}
      {isApiKeyError && (
        <div className="text-sm text-gray-500 bg-yellow-50 p-3 rounded-md border border-yellow-200">
          <p className="font-bold mb-1">Invalid API Key</p>
          <p>
            Please double-check that your API key is correct and has been
            enabled for the Gemini API.
          </p>
        </div>
      )}
    </>
  );
};

export default function Home() {
  const canvasRef = useRef(null);
  const backgroundImageRef = useRef(null);
  const importImageInputRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const colorInputRef = useRef(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(
    'gemini-2.5-flash-image-preview',
  );
  const [historyState, setHistoryState] = useState<{
    stack: string[];
    index: number;
  }>({stack: [], index: -1});

  useEffect(() => {
    const storedApiKey = localStorage.getItem('gemini-api-key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setTempApiKey(storedApiKey);
    } else {
      setShowApiKeyModal(true);
    }
  }, []);

  const saveCanvasState = useCallback(() => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL();
    setHistoryState((prev) => {
      const newStack = prev.stack.slice(0, prev.index + 1);
      newStack.push(dataUrl);
      return {
        stack: newStack,
        index: newStack.length - 1,
      };
    });
  }, []);

  // Initialize canvas and history
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Fill canvas with white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Save initial state
      const dataUrl = canvas.toDataURL();
      setHistoryState({stack: [dataUrl], index: 0});
    }
  }, []);

  // Draw the generated image to the canvas and save state
  useEffect(() => {
    if (generatedImage && canvasRef.current) {
      const img = new window.Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        drawImageToCanvas();
        saveCanvasState();
      };
      img.src = generatedImage;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedImage]);

  const restoreCanvasState = (dataUrl: string) => {
    if (!canvasRef.current || !dataUrl) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear before drawing
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  };

  // Draw the background image to the canvas
  const drawImageToCanvas = () => {
    if (!canvasRef.current || !backgroundImageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fill with white background first
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the background image
    ctx.drawImage(
      backgroundImageRef.current,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  };

  // Get the correct coordinates based on canvas scaling
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Calculate the scaling factor between the internal canvas size and displayed size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Apply the scaling to get accurate coordinates
    return {
      x:
        (e.nativeEvent.offsetX ||
          e.nativeEvent.touches?.[0]?.clientX - rect.left) * scaleX,
      y:
        (e.nativeEvent.offsetY ||
          e.nativeEvent.touches?.[0]?.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const {x, y} = getCoordinates(e);

    // Prevent default behavior to avoid scrolling on touch devices
    if (e.type === 'touchstart') {
      e.preventDefault();
    }

    // Start a new path without clearing the canvas
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    // Prevent default behavior to avoid scrolling on touch devices
    if (e.type === 'touchmove') {
      e.preventDefault();
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const {x, y} = getCoordinates(e);

    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveCanvasState();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fill with white instead of just clearing
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveCanvasState();

    setGeneratedImage(null);
    backgroundImageRef.current = null;
  };

  const handleUndo = () => {
    if (historyState.index <= 0) return;
    const newIndex = historyState.index - 1;
    restoreCanvasState(historyState.stack[newIndex]);
    setHistoryState((prev) => ({...prev, index: newIndex}));
  };

  const handleRedo = () => {
    if (historyState.index >= historyState.stack.length - 1) return;
    const newIndex = historyState.index + 1;
    restoreCanvasState(historyState.stack[newIndex]);
    setHistoryState((prev) => ({...prev, index: newIndex}));
  };

  const handleColorChange = (e) => {
    setPenColor(e.target.value);
  };

  const openColorPicker = () => {
    if (colorInputRef.current) {
      colorInputRef.current.click();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      openColorPicker();
    }
  };

  const openImportDialog = () => {
    if (importImageInputRef.current) {
      importImageInputRef.current.click();
    }
  };

  const handleImageImport = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            // Clear canvas with white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Calculate aspect ratio to fit and center the image
            const hRatio = canvas.width / img.width;
            const vRatio = canvas.height / img.height;
            const ratio = Math.min(hRatio, vRatio);
            const centerShiftX = (canvas.width - img.width * ratio) / 2;
            const centerShiftY = (canvas.height - img.height * ratio) / 2;

            // Draw the imported image on the canvas
            ctx.drawImage(
              img,
              0,
              0,
              img.width,
              img.height,
              centerShiftX,
              centerShiftY,
              img.width * ratio,
              img.height * ratio,
            );
            saveCanvasState();

            // Reset any previously generated image state
            setGeneratedImage(null);
            backgroundImageRef.current = null;
          }
        };
        img.src = event.target.result as string;
      };
      reader.readAsDataURL(file);
      e.target.value = ''; // Reset file input to allow re-uploading the same file
    }
  };

  const downloadCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'gemini-co-drawing.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }

    if (!canvasRef.current) return;

    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({apiKey});
      // Get the drawing as base64 data
      const canvas = canvasRef.current;

      // Create a temporary canvas to add white background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Fill with white background
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw the original canvas content on top of the white background
      tempCtx.drawImage(canvas, 0, 0);

      const drawingData = tempCanvas.toDataURL('image/png').split(',')[1];

      // Create request payload
      const requestPayload = {
        prompt,
        drawingData,
      };

      // Log the request payload (without the full image data for brevity)
      console.log('Request payload:', {
        ...requestPayload,
        drawingData: drawingData
          ? `${drawingData.substring(0, 50)}... (truncated)`
          : null,
      });

      let contents: Content[] = [
        {
          role: 'USER',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      if (drawingData) {
        contents = [
          {
            role: 'USER',
            parts: [{inlineData: {data: drawingData, mimeType: 'image/png'}}],
          },
          {
            role: 'USER',
            parts: [
              {
                text: `${prompt}. Keep the same minimal line drawing style.`,
              },
            ],
          },
        ];
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const data = {
        success: true,
        message: '',
        imageData: null,
        error: undefined,
      };

      for (const part of response.candidates[0].content.parts) {
        // Based on the part type, either get the text or image data
        if (part.text) {
          data.message = part.text;
          console.log('Received text response:', part.text);
        } else if (part.inlineData) {
          const imageData = part.inlineData.data;
          console.log('Received image data, length:', imageData.length);

          // Include the base64 data in the response
          data.imageData = imageData;
        }
      }

      // Log the response (without the full image data for brevity)
      console.log('Response:', {
        ...data,
        imageData: data.imageData
          ? `${data.imageData.substring(0, 50)}... (truncated)`
          : null,
      });

      if (data.success && data.imageData) {
        const imageUrl = `data:image/png;base64,${data.imageData}`;
        setGeneratedImage(imageUrl);
      } else {
        console.error('Failed to generate image:', data.error);
        alert('Failed to generate image. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting drawing:', error);
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Close the error modal
  const closeErrorModal = () => {
    setShowErrorModal(false);
  };

  const handleApiKeySave = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempApiKey.trim()) {
      const newApiKey = tempApiKey.trim();
      setApiKey(newApiKey);
      localStorage.setItem('gemini-api-key', newApiKey);
      setShowApiKeyModal(false);
    }
  };

  // Add touch event prevention function
  useEffect(() => {
    // Function to prevent default touch behavior on canvas
    const preventTouchDefault = (e) => {
      if (isDrawing) {
        e.preventDefault();
      }
    };

    // Add event listener when component mounts
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('touchstart', preventTouchDefault, {
        passive: false,
      });
      canvas.addEventListener('touchmove', preventTouchDefault, {
        passive: false,
      });
    }

    // Remove event listener when component unmounts
    return () => {
      if (canvas) {
        canvas.removeEventListener('touchstart', preventTouchDefault);
        canvas.removeEventListener('touchmove', preventTouchDefault);
      }
    };
  }, [isDrawing]);

  return (
    <>
      <div className="min-h-screen notebook-paper-bg text-gray-900 flex flex-col justify-start items-center">
        <main className="container mx-auto px-3 sm:px-6 py-5 sm:py-10 pb-32 max-w-5xl w-full">
          {/* Header section with title and tools */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 sm:mb-6 gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-0 leading-tight font-mega">
                Gemini Co drawing with Flash 2.5 support
              </h1>
              <p className="text-sm sm:text-base text-gray-500 mt-1">
                Built with{' '}
                <a
                  className="underline"
                  href="https://ai.google.dev/gemini-api/docs/image-generation"
                  target="_blank"
                  rel="noopener noreferrer">
                  Gemini native image generation
                </a>
              </p>
              <p className="text-sm sm:text-base text-gray-500 mt-1">
                by Swapnil
              </p>
            </div>

            <menu className="flex items-center bg-gray-300 rounded-full p-2 shadow-sm self-start sm:self-auto">
              <div className="relative mr-2">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="h-10 rounded-full bg-white pl-3 pr-8 text-sm text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 appearance-none border-2 border-white"
                  aria-label="Select Gemini Model">
                  <option value="gemini-2.5-flash-image-preview">
                    2.5 Flash
                  </option>
                  <option value="gemini-2.0-flash-preview-image-generation">
                    2.0 Flash
                  </option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
              <button
                type="button"
                className="w-10 h-10 rounded-full overflow-hidden mr-2 flex items-center justify-center border-2 border-white shadow-sm transition-transform hover:scale-110"
                onClick={openColorPicker}
                onKeyDown={handleKeyDown}
                aria-label="Open color picker"
                style={{backgroundColor: penColor}}>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={penColor}
                  onChange={handleColorChange}
                  className="opacity-0 absolute w-px h-px"
                  aria-label="Select pen color"
                />
              </button>
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyState.index <= 0}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110 mr-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                aria-label="Undo">
                <Undo2 className="w-5 h-5 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyState.index >= historyState.stack.length - 1}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110 mr-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                aria-label="Redo">
                <Redo2 className="w-5 h-5 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={openImportDialog}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110 mr-2"
                aria-label="Import Image">
                <Upload className="w-5 h-5 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={downloadCanvas}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110 mr-2"
                aria-label="Download Image">
                <Download className="w-5 h-5 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110">
                <Trash2
                  className="w-5 h-5 text-gray-700"
                  aria-label="Clear Canvas"
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempApiKey(apiKey);
                  setShowApiKeyModal(true);
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110 ml-2"
                aria-label="Set API Key">
                <KeyRound className="w-5 h-5 text-gray-700" />
              </button>
            </menu>
          </div>

          <input
            type="file"
            ref={importImageInputRef}
            onChange={handleImageImport}
            className="hidden"
            accept="image/*"
            aria-label="Import image file"
          />

          {/* Canvas section with notebook paper background */}
          <div className="w-full mb-6">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className={`border-2 border-black w-full hover:cursor-crosshair sm:h-[60vh] h-[30vh] min-h-[320px] bg-white/90 touch-none transition-all duration-300 ${
                isLoading ? 'pulsing-canvas' : ''
              }`}
            />
          </div>

          {/* Input form that matches canvas width */}
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Add your change..."
                className="w-full p-3 sm:p-4 pr-12 sm:pr-14 text-sm sm:text-base border-2 border-black bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-gray-200 focus:outline-none transition-all font-mono"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-none bg-black text-white hover:cursor-pointer hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                {isLoading ? (
                  <LoaderCircle
                    className="w-5 sm:w-6 h-5 sm:h-6 animate-spin"
                    aria-label="Loading"
                  />
                ) : (
                  <SendHorizontal
                    className="w-5 sm:w-6 h-5 sm:h-6"
                    aria-label="Submit"
                  />
                )}
              </button>
            </div>
          </form>
        </main>
        {/* API Key Modal */}
        {showApiKeyModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Close"
                disabled={!apiKey}>
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-bold text-gray-700 mb-4">
                Gemini API Key
              </h3>
              <p className="text-gray-600 mb-2">
                Your API key is stored in your browser's local storage and is
                required to generate images.
              </p>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline mb-4 block">
                Get your Gemini API Key here
              </a>
              <form onSubmit={handleApiKeySave}>
                <label htmlFor="api-key-input" className="sr-only">
                  Gemini API Key
                </label>
                <input
                  id="api-key-input"
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="w-full p-3 border-2 border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:outline-none"
                />
                <div className="flex justify-end mt-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:bg-gray-400"
                    disabled={!tempApiKey.trim()}>
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Error Modal */}
        {showErrorModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-700">
                  Failed to generate
                </h3>
                <button
                  onClick={closeErrorModal}
                  className="text-gray-400 hover:text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ErrorDisplay message={errorMessage} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}