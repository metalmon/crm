<template>
  <div class="single-image-uploader">
    <!-- Input is always present but hidden -->
    <input
        type="file"
        class="hidden"
        ref="fileInput"
        @change="onFileInput"
        :accept="imageMimeTypes"
      />

    <!-- Display existing image or upload prompt -->
    <div v-if="currentImageUrl" class="relative group max-w-[300px]">
      <img
        :src="currentImageUrl"
        class="w-full h-auto rounded-lg object-contain max-h-[300px]"
        alt="Uploaded image"
      />
      <div class="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2">
        <Button
          variant="ghost"
          class="text-white hover:text-white"
          @click="browseFiles"
        >
          <template #prefix>
            <CameraIcon class="h-4 w-4" />
          </template>
          {{ __("Change Image") }}
        </Button>
        <Button
          variant="ghost"
          class="text-white hover:text-white w-40"
          @click="removeImage"
        >
          <template #prefix>
            <FeatherIcon name="trash-2" class="h-4 w-4" />
          </template>
          {{ __("Remove") }}
        </Button>
      </div>
    </div>

    <div
      v-else
      class="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
      @dragover.prevent="dragover"
      @dragleave.prevent="dragleave"
      @drop.prevent="dropfiles"
      @click="browseFiles"
    >
      <div v-if="isDragging" class="text-ink-gray-5">{{ __("Drop image here") }}</div>
      <div class="flex flex-col items-center justify-center gap-2">
         <CameraIcon class="h-8 w-8 mx-auto mb-2 text-gray-400" />
         <div class="text-sm text-gray-600">
           {{ __("Click or drag to upload image") }}
         </div>
         <div class="text-xs text-gray-500 mt-1">
           {{ __("Supported formats: PNG, JPG, GIF, SVG, BMP, WebP") }}
         </div>
         <div v-if="uploading" class="mt-2">
            <CircularProgressBar
                :step="uploadProgress"
                :totalSteps="100"
                size="sm"
                :showPercentage="true"
             />
         </div>
         <div v-if="errorMessage" class="mt-2 text-red-500 text-xs">
            {{ errorMessage }}
         </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { Button, FeatherIcon, CircularProgressBar } from 'frappe-ui'
import CameraIcon from '@/components/Icons/CameraIcon.vue'
// Используем обработчик из общего FilesUploader
import FilesUploadHandler from '../FilesUploader/filesUploaderHandler'
import { createToast } from '@/utils'

const props = defineProps({
  imageUrl: String, // Existing image URL
  doctype: String, // Optional: for attaching to doctype
  docname: String, // Optional: for attaching to docname
  folder: {       // Optional: target folder
    type: String,
    default: 'Home/Attachments',
  },
})

const emit = defineEmits(['upload', 'remove'])

const currentImageUrl = ref(props.imageUrl)
const fileInput = ref(null)
const isDragging = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref(null)
const uploader = ref(null)

const imageMimeTypes = 'image/png, image/jpeg, image/gif, image/svg+xml, image/bmp, image/webp'

watch(() => props.imageUrl, (newVal) => {
  currentImageUrl.value = newVal
})

function validateFile(file) {
  if (!file) return false
  const extn = file.name.split('.').pop().toLowerCase()
  if (!['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp'].includes(extn)) {
    errorMessage.value = __('Only PNG, JPG, GIF, SVG, BMP and WebP images are allowed')
    return false
  }
  // Add size validation if needed (using restrictions from options/defaults)
  errorMessage.value = null;
  return true
}

function dragover() {
  isDragging.value = true
}

function dragleave() {
  isDragging.value = false
}

function dropfiles(e) {
  isDragging.value = false
  if (e.dataTransfer.files.length > 0) {
    handleFile(e.dataTransfer.files[0]) // Handle only the first file
  }
}

function browseFiles() {
  fileInput.value.click()
}

function onFileInput(event) {
  if (fileInput.value.files.length > 0) {
    handleFile(fileInput.value.files[0]) // Handle only the first file
    fileInput.value.value = '' // Reset input to allow uploading the same file again
  }
}

function removeImage() {
    currentImageUrl.value = null
    emit('remove')
}

function handleFile(fileObj) {
  if (!validateFile(fileObj)) {
    return
  }

  errorMessage.value = null
  uploading.value = true
  uploadProgress.value = 0

  const fileData = {
      fileObj: fileObj,
      name: fileObj.name,
      type: fileObj.type,
      size: fileObj.size,
      private: 1, // Force private upload
      uploading: true,
      errorMessage: null,
      uploaded: 0,
      total: 100, // For progress bar visual
  }

  const args = {
    fileObj: fileData.fileObj,
    type: fileData.type,
    private: fileData.private, // Ensure this is passed correctly
    folder: props.folder,
    doctype: props.doctype,
    docname: props.docname,
    // No fileUrl needed for direct upload
  }

  uploader.value = new FilesUploadHandler()

  uploader.value.on('start', () => {
    // Already set uploading = true
  })
  uploader.value.on('progress', (data) => {
     // FilesUploadHandler calculates based on total file size,
     // but for a single file, let's map it to percentage.
     if (data.total > 0) {
         uploadProgress.value = Math.round((data.uploaded / data.total) * 100)
     } else {
         // Handle cases where total might be 0 initially
         uploadProgress.value = data.progress || 0;
     }
  })
  uploader.value.on('error', (error) => {
    uploading.value = false
    uploadProgress.value = 0
    errorMessage.value = error || 'Error Uploading File'
     createToast({ title: errorMessage.value, icon: 'x', iconClasses: 'text-red-500' })
  })
  uploader.value.on('finish', (uploadedFile) => {
     // This is the event handler for FilesUploadHandler
     // It seems the handler itself doesn't directly return the final file object
     // We need to wait for the 'then' block below
  })

  // Call the upload method from the handler
  uploader.value
    .upload(fileData, args) // Pass fileData and args
    .then((uploadedFile) => {
      // THIS is where we should get the final file info
      uploading.value = false
      uploadProgress.value = 100
      if (uploadedFile && uploadedFile.file_url) {
        currentImageUrl.value = uploadedFile.file_url
        emit('upload', uploadedFile.file_url)
        createToast({ title: __("Image uploaded successfully"), icon: 'check', iconClasses: 'text-green-500' })
      } else {
         // Handle case where upload technically succeeded but no URL returned
         errorMessage.value = __("Upload finished but failed to get file URL.");
         createToast({ title: errorMessage.value, icon: 'x', iconClasses: 'text-red-500' })
      }
    })
    .catch((error) => {
      // Error handling is mostly done via the 'error' event, but catch ensures promise rejection is handled
      uploading.value = false
      uploadProgress.value = 0
      if (!errorMessage.value) { // Set error message if not already set by the event
          errorMessage.value = 'Error Uploading File';
      }
      console.error("Upload failed:", error)
       // Toast might already be shown by the 'error' event handler
    })
}

</script>

<style scoped>
/* Add any specific styles if needed */
</style> 