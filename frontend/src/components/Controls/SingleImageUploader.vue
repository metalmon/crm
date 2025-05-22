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
        :alt="__('Uploaded image')"
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
import { ref, watch, onUnmounted } from 'vue'
import { Button, FeatherIcon, CircularProgressBar, toast } from 'frappe-ui'
import CameraIcon from '@/components/Icons/CameraIcon.vue'
// Используем обработчик из общего FilesUploader
import FilesUploadHandler from '../FilesUploader/filesUploaderHandler'

const props = defineProps({
  imageUrl: String, // Existing image URL
  doctype: String, // Optional: for attaching to doctype
  docname: String, // Optional: for attaching to docname
  folder: {       // Optional: target folder
    type: String,
    default: 'Home/Attachments',
  },
})

const emit = defineEmits(['upload', 'remove', 'select'])

const currentImageUrl = ref(props.imageUrl)
const fileInput = ref(null)
const isDragging = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref(null)
const uploader = ref(null)
let tempObjectUrl = null

const imageMimeTypes = 'image/png, image/jpeg, image/gif, image/svg+xml, image/bmp, image/webp'

watch(() => props.imageUrl, (newVal) => {
  currentImageUrl.value = newVal
})

onUnmounted(() => {
  if (tempObjectUrl) {
    URL.revokeObjectURL(tempObjectUrl)
    tempObjectUrl = null
  }
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
    handleFileInput(e.dataTransfer.files[0]) // Handle only the first file
  }
}

function browseFiles() {
  fileInput.value.click()
}

function onFileInput(event) {
  if (fileInput.value.files.length > 0) {
    handleFileInput(fileInput.value.files[0]) // Handle only the first file
    fileInput.value.value = '' // Reset input to allow uploading the same file again
  }
}

function removeImage() {
    if (tempObjectUrl) {
      URL.revokeObjectURL(tempObjectUrl)
      tempObjectUrl = null
    }
    currentImageUrl.value = null
    emit('remove')
}

function handleFileInput(file) {
  if (!validateFile(file)) {
    return
  }
  if (!props.docname) {
    // Use a temporary object URL for preview
    if (tempObjectUrl) {
      URL.revokeObjectURL(tempObjectUrl)
    }
    tempObjectUrl = URL.createObjectURL(file)
    currentImageUrl.value = tempObjectUrl
    emit('select', file, tempObjectUrl)
    return
  }
  handleFile(file)
}

function handleFile(fileObj) {
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
     if (data.total > 0) {
         uploadProgress.value = Math.round((data.uploaded / data.total) * 100)
     } else {
         uploadProgress.value = data.progress || 0;
     }
  })
  uploader.value.on('error', (error) => {
    uploading.value = false
    uploadProgress.value = 0
    errorMessage.value = error || 'Error Uploading File'
     toast.error(errorMessage.value)
  })
  uploader.value.on('finish', (uploadedFile) => {
     // This is the event handler for FilesUploadHandler
  })

  uploader.value
    .upload(fileData, args) // Pass fileData and args
    .then((uploadedFile) => {
      uploading.value = false
      uploadProgress.value = 100
      if (uploadedFile && uploadedFile.file_url) {
        if (tempObjectUrl) {
          URL.revokeObjectURL(tempObjectUrl)
          tempObjectUrl = null
        }
        currentImageUrl.value = uploadedFile.file_url
        emit('upload', uploadedFile.file_url)
        toast.success(__("Image uploaded successfully"))
      } else {
         errorMessage.value = __("Upload finished but failed to get file URL.");
         toast.error(errorMessage.value)
      }
    })
    .catch((error) => {
      uploading.value = false
      uploadProgress.value = 0
      if (!errorMessage.value) {
          errorMessage.value = 'Error Uploading File';
      }
      console.error("Upload failed:", error)
    })
}

</script>

<style scoped>
/* Add any specific styles if needed */
</style> 