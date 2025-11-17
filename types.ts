

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
        reviewSnippets: {
            text: string;
            authorName: string;
        }[];
    }
  };
}

export interface GroundingMetadata {
    groundingChunks: GroundingChunk[];
}

export interface GeolocationCoordinates {
    latitude: number;
    longitude: number;
}


// Pexels Photo
export interface PexelsPhoto {
  id: number;
  src: {
    large2x: string;
    original: string;
  };
  alt: string;
}

export interface PexelsPhotoSearchResponse {
  photos: PexelsPhoto[];
}

// Pexels Video
export interface PexelsVideoFile {
    id: number;
    quality: 'hd' | 'sd';
    link: string;
}

export interface PexelsVideoPicture {
    id: number;
    picture: string;
}

export interface PexelsVideo {
    id: number;
    image: string;
    video_files: PexelsVideoFile[];
    video_pictures: PexelsVideoPicture[];
}

export interface PexelsVideoSearchResponse {
    videos: PexelsVideo[];
}
