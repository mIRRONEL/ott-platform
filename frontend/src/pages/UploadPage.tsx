import React, { useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import api from '../services/api';

interface ProcessingStatus {
  videoId: string;
  status: string;
  hlsProgress: number;
  processingStage: string;
  title: string;
}

export default function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [processingComplete, setProcessingComplete] = useState(false);

  const categories = [
    'General',
    'Movies',
    'TV Series',
    'Documentaries',
    'Educational',
    'Sports',
    'Music',
    'Comedy',
    'Drama',
    'Action',
    'Other'
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024 * 1024) {
        setError('File size cannot exceed 5GB');
        setSelectedFile(null);
        return;
      }
      const videoExtensions = ['mp4', 'mpeg', 'mov', 'avi', 'webm'];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (!fileExtension || !videoExtensions.includes(fileExtension)) {
        setError('Only video files are allowed (mp4, mpeg, mov, avi, webm)');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile || !title.trim()) {
      setError('Please select a file and enter a title');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);
    setProcessingStatus(null);
    setProcessingComplete(false);

    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);

      // Upload with progress tracking
      const response = await api.uploadVideo(formData);
      const videoId = response.data.data.videoId;
      
      setUploadProgress(100);
      setSuccess(`Video uploaded! Processing HLS segments...`);
      
      // Track HLS processing progress
      let isProcessing = true;
      const progressInterval = setInterval(async () => {
        try {
          const progressResponse = await api.getProcessingProgress(videoId);
          const status = progressResponse.data.data;
          
          setProcessingStatus(status);
          
          if (status.status === 'ready' || status.hlsProgress === 100) {
            isProcessing = false;
            clearInterval(progressInterval);
            setProcessingComplete(true);
            setSuccess(`✅ Video "${title}" is ready to play!`);
            
            // Redirect after 3 seconds
            setTimeout(() => {
              window.location.href = '/browse';
            }, 3000);
          }
        } catch (err) {
          console.error('Failed to check progress:', err);
        }
      }, 1000); // Check every 1 second

      // Clear interval after 5 minutes to avoid infinite polling
      setTimeout(() => {
        if (isProcessing) {
          clearInterval(progressInterval);
        }
      }, 300000);

    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload video');
      console.error('Upload error:', err);
      setProcessingStatus(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Upload Video</h1>

        {error && (
          <div className="flex items-center gap-3 bg-red-500 bg-opacity-20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-3 bg-green-500 bg-opacity-20 border border-green-500 text-green-300 px-4 py-3 rounded-lg mb-6">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-lg p-8 border border-slate-700">
          {/* File Upload Area */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">Video File *</label>
            <div className="relative">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                disabled={loading}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className={`block w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                  selectedFile
                    ? 'border-green-500 bg-green-500 bg-opacity-10'
                    : 'border-slate-600 hover:border-slate-500'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload
                  size={48}
                  className={`mx-auto mb-3 ${selectedFile ? 'text-green-400' : 'text-slate-400'}`}
                />
                {selectedFile ? (
                  <div>
                    <p className="text-green-400 font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-slate-400 mt-1">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-200 font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-slate-400 mt-1">
                      MP4, MPEG, MOV, AVI, WebM (Max 5GB)
                    </p>
                  </div>
                )}
              </label>
            </div>
            {selectedFile && (
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="mt-2 text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <X size={16} /> Clear selection
              </button>
            )}
          </div>

          {/* Upload Progress */}
          {loading && uploadProgress > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Uploading...</span>
                <span className="text-sm text-slate-400">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* HLS Processing Progress */}
          {processingStatus && !processingComplete && (
            <div className="mb-6 bg-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <Loader size={20} className="animate-spin text-indigo-400" />
                <div className="flex-1">
                  <p className="font-medium text-slate-200">Processing Video...</p>
                  <p className="text-sm text-slate-400 mt-1">{processingStatus.processingStage}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">HLS Processing</span>
                <span className="text-sm text-slate-400">{processingStatus.hlsProgress}%</span>
              </div>
              <div className="w-full bg-slate-600 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${processingStatus.hlsProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Title */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              placeholder="Enter video title"
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:border-indigo-500 focus:outline-none transition disabled:opacity-50"
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              placeholder="Enter video description (optional)"
              rows={4}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:border-indigo-500 focus:outline-none transition resize-none disabled:opacity-50"
            />
          </div>

          {/* Category */}
          <div className="mb-8">
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 focus:border-indigo-500 focus:outline-none transition disabled:opacity-50"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !selectedFile || !title.trim()}
            className={`w-full py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
              loading || !selectedFile || !title.trim()
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
            }`}
          >
            <Upload size={20} />
            {loading ? 'Uploading...' : 'Upload Video'}
          </button>
        </form>

        <div className="mt-8 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <h3 className="font-semibold mb-2">Upload Requirements:</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>• Supported formats: MP4, MPEG, MOV, AVI, WebM</li>
            <li>• Maximum file size: 5GB</li>
            <li>• Title is required</li>
            <li>• Videos are processed and ready within seconds</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
