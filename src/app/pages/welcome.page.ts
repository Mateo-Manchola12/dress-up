import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Media } from '@capacitor-community/media';
import { Capacitor } from '@capacitor/core';

interface MediaWithPermissions {
  checkPermissions(): Promise<{
    photos?: string;
    publicStorage?: string;
    publicStorage13Plus?: string;
  }>;
  requestPermissions(): Promise<{
    photos?: string;
    publicStorage?: string;
    publicStorage13Plus?: string;
  }>;
}

@Component({
  selector: 'app-welcome',
  template: `
    <div
      class="relative flex h-dvh w-screen flex-col items-center justify-center overflow-hidden bg-neutral-950 px-6 font-sans text-white"
    >
      <!-- Glow background decoration -->
      <div
        class="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-rose-500/10 blur-[120px] pointer-events-none"
      ></div>
      <div
        class="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none"
      ></div>

      <!-- Main card container -->
      <div
        class="w-full max-w-md rounded-3xl bg-black/40 border border-white/10 p-8 text-center backdrop-blur-xl shadow-2xl animate-fade-in"
      >
        <!-- Icon/Logo representation -->
        <div
          class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-cyan-500 p-[1.5px] shadow-lg"
        >
          <div class="flex h-full w-full items-center justify-center rounded-2xl bg-neutral-900">
            <span class="material-icons text-4xl text-rose-400 select-none animate-pulse"
              >camera</span
            >
          </div>
        </div>

        <h1 class="mb-3 text-3xl font-black tracking-tight text-white">
          Dress-Up
          <span class="bg-gradient-to-r from-rose-400 to-cyan-400 bg-clip-text text-transparent"
            >Trainer</span
          >
        </h1>
        <p class="mb-8 text-sm leading-relaxed text-neutral-400">
          Bienvenido al cliente de captura para entrenamiento de IA. Aquí capturamos poses y gestos
          de forma interactiva y optimizada en tiempo real.
        </p>

        <!-- Permissions requirement explanation -->
        <div class="mb-8 rounded-2xl bg-white/5 p-4 text-left border border-white/5">
          <h2 class="mb-3 text-xs font-bold uppercase tracking-wider text-rose-400">
            Permisos necesarios
          </h2>

          <div class="mb-3 flex items-start gap-3">
            <span class="material-icons text-sm text-cyan-400 mt-0.5">videocam</span>
            <div>
              <p class="text-xs font-semibold text-white">Acceso a la cámara</p>
              <p class="text-[10px] text-neutral-400">
                Requerido para la detección de gestos y grabación en directo.
              </p>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <span class="material-icons text-sm text-cyan-400 mt-0.5">photo_library</span>
            <div>
              <p class="text-xs font-semibold text-white">Acceso a la galería de fotos</p>
              <p class="text-[10px] text-neutral-400">
                Requerido para salvar copias locales de las capturas en tu dispositivo.
              </p>
            </div>
          </div>
        </div>

        <!-- Start Button -->
        <button
          (click)="onStartClick()"
          [disabled]="isChecking()"
          class="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-rose-500 to-cyan-500 p-[1px] font-bold shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <div
            class="flex h-12 w-full items-center justify-center rounded-2xl bg-neutral-900 transition-colors hover:bg-neutral-800"
          >
            @if (isChecking()) {
              <span class="text-xs text-neutral-400">Comprobando permisos...</span>
            } @else {
              <span
                class="bg-gradient-to-r from-rose-400 to-cyan-400 bg-clip-text text-transparent text-sm uppercase tracking-wider"
                >Comenzar</span
              >
            }
          </div>
        </button>

        @if (permissionError()) {
          <div class="mt-4 text-xs font-medium text-rose-400 animate-fade-in">
            {{ permissionError() }}
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .animate-fade-in {
      animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomePage {
  private router = inject(Router);
  readonly isChecking = signal<boolean>(false);
  readonly permissionError = signal<string>('');

  async onStartClick() {
    this.isChecking.set(true);
    this.permissionError.set('');

    try {
      const cameraGranted = await this.requestCameraPermission();
      if (!cameraGranted) {
        this.permissionError.set(
          'Acceso a la cámara denegado. Es obligatorio para esta aplicación.',
        );
        this.isChecking.set(false);
        return;
      }

      const photosGranted = await this.requestPhotoPermission();
      if (!photosGranted) {
        this.permissionError.set(
          'Acceso a la galería denegado. No se podrán salvar fotos locales.',
        );
      }

      // Proceed to the camera page
      await this.router.navigate(['/camera']);
    } catch (err) {
      console.error('Error during start permission flow:', err);
      this.permissionError.set('Ocurrió un error al verificar los permisos.');
    } finally {
      this.isChecking.set(false);
    }
  }

  private async requestCameraPermission(): Promise<boolean> {
    try {
      const hasMediaDevices = typeof window !== 'undefined' && 
        !!(navigator as unknown as Record<string, unknown>)['mediaDevices'];
      if (hasMediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        // Release tracks
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async requestPhotoPermission(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const mediaWithPerms = Media as unknown as MediaWithPermissions;
        let status = await mediaWithPerms.checkPermissions();
        if (this.isPermissionGranted(status)) {
          return true;
        }
        status = await mediaWithPerms.requestPermissions();
        return this.isPermissionGranted(status);
      }
      return true;
    } catch {
      return false;
    }
  }

  private isPermissionGranted(status: {
    photos?: string;
    publicStorage?: string;
    publicStorage13Plus?: string;
  }): boolean {
    if (status.photos !== undefined) {
      return status.photos === 'granted';
    }
    return status.publicStorage === 'granted' || status.publicStorage13Plus === 'granted';
  }
}
