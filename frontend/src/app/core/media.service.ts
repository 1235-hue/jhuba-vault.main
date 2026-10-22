import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Asset, User } from './models';

export interface MediaUpload { url: string; asset?: Asset; }
export interface UploadProgress { percent: number; result?: MediaUpload; }

type MediaResponse = Asset | { url: string; user: User };

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly http = inject(HttpClient);
  upload(file: File, folder: 'profile' | 'assets', assetId?: string): Observable<UploadProgress> {
    const data = new FormData(); data.append('file', file); data.append('folder', folder);
    const endpoint = folder === 'assets' && assetId ? `/api/uploads/assets/${assetId}/image` : `/api/uploads/${folder}`;
    return this.http.post<{ success: boolean; data: MediaResponse }>(endpoint, data, { observe: 'events', reportProgress: true }).pipe(map((event: HttpEvent<{ success: boolean; data: MediaResponse }>) => {
      if (event.type === HttpEventType.UploadProgress) return { percent: event.total ? Math.round((event.loaded / event.total) * 100) : 0 };
      if (event.type !== HttpEventType.Response) return { percent: 0 };
      const response = event.body?.data;
      if (!response) throw new Error('Media API returned an empty response.');
      return 'assetTag' in response
        ? { percent: 100, result: { url: response.imageUrl ?? '', asset: response } }
        : { percent: 100, result: { url: response.url } };
    }));
  }
  removeAssetImage(assetId: string): Observable<void> { return this.http.delete<void>(`/api/uploads/assets/${assetId}/image`); }
}
