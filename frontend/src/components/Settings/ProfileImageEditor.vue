<template>
  <FileUploader
    @success="(file) => setUserImage(file.file_url)"
    :validateFile="validateIsImageFile"
  >
    <template v-slot="{ file, progress, error, uploading, openFileSelector }">
      <div class="flex flex-col items-center">
        <button
          class="group relative rounded-full border-2"
          @click="openFileSelector"
        >
          <div
            class="absolute inset-0 grid place-items-center rounded-full bg-gray-400/20 text-base text-ink-gray-5 transition-opacity"
            :class="[
              uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              'drop-shadow-sm',
            ]"
          >
            <span
              class="inline-block rounded-md bg-surface-gray-7/60 px-2 py-1 text-ink-white"
            >
              {{
                uploading
                  ? __('Uploading') + ' ' + progress + '%'
                  : profile.user_image
                  ? __('Change Image')
                  : __('Upload Image')
              }}
            </span>
          </div>
          <img
            v-if="profile.user_image"
            class="h-64 w-64 rounded-full object-cover"
            :src="profile.user_image"
            :alt="__('Profile Photo')"
          />
          <div v-else class="h-64 w-64 rounded-full bg-surface-gray-2"></div>
        </button>
        <ErrorMessage class="mt-4" :message="error" />
        <div class="mt-4 flex items-center gap-4">
          <Button v-if="profile.user_image" @click="setUserImage(null)">
            {{ __('Remove') }}
          </Button>
        </div>
      </div>
    </template>
  </FileUploader>
</template>
<script setup>
import { FileUploader } from 'frappe-ui'
import { validateIsImageFile } from '@/utils';

const profile = defineModel()

function setUserImage(url) {
  profile.value.user_image = url
}

function validateFile(file) {
  let extn = file.name.split('.').pop().toLowerCase()
  if (!['png', 'jpg'].includes(extn)) {
    return __('Only PNG and JPG images are allowed')
  }
}
</script>
