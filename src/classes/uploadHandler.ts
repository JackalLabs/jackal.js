import {
  IProviderPool,
  IProviderStatusResponse,
  IProviderUploadResponse,
  IUploadDetails,
  TMergedProviderResponse,
} from '@/interfaces'
import { setDelay, shuffleArray, warnError } from '@/utils/misc'
import { hexToBuffer } from '@/utils/hash'
import { IUploadHandler } from '@/interfaces/classes'

export class UploadHandler implements IUploadHandler {
  providers: IProviderPool
  readyProviders: string[]
  jklAddress: string
  queue: IUploadDetails[]
  runQueue: boolean
  completed: Record<string, string[]>

  constructor (providers: IProviderPool, jklAddress: string) {
    this.providers = providers
    this.readyProviders = Object.values(providers).flat().map(prov => prov.ip)
    this.jklAddress = jklAddress

    this.queue = []
    this.runQueue = true
    this.completed = {}

    this.hostQueue()
  }

  /**
   *
   * @param {IUploadDetails} details
   * @param {number} existing
   * @param {number} copies
   * @returns {Promise<IProviderUploadResponse>}
   */
  async upload (details: IUploadDetails, existing: number, copies = 2): Promise<IProviderUploadResponse> {
    try {
      if (existing >= this.readyProviders.length) {
        return {
          merkle: hexToBuffer(details.merkle),
          owner: this.jklAddress,
          start: details.uploadHeight,
          cid: '',
        }
      }
      const results = await this.attempt(details)
      for (let i = 0; i < copies - existing; i++) {
        this.queue.push(details)
      }
      return results
    } catch (err) {
      throw warnError('UploadHandler upload()', err)
    }
  }

  startQueue () {
    this.runQueue = true
  }

  stopQueue () {
    this.runQueue = false
  }

  /**
   *
   * @param {IUploadDetails} details
   * @returns {Promise<IProviderUploadResponse>}
   * @private
   */
  private async attempt (details: IUploadDetails): Promise<IProviderUploadResponse> {
    const providerOrder = shuffleArray(this.readyProviders)
    while (providerOrder.length > 0) {
      try {
        const ip = providerOrder.shift() as string
        if (ip in (this.completed[details.merkle] || [])) {
          continue
        }
        const v2Url = `${ip}/v2/upload`
        const uploadJob = await this.uploadFile(v2Url, details)

        if (!('job_id' in uploadJob)) {
          const v1Url = `${ip}/upload`
          const results = await this.uploadFile(v1Url, details) as IProviderUploadResponse
          if (!this.completed[details.merkle]) {
            this.completed[details.merkle] = [ip]
          } else {
            this.completed[details.merkle].push(ip)
          }
          return results
        } else {
          const pollUrl = `${ip}/v2/status/${uploadJob.job_id}`
          const results = await this.pollForCompletion(pollUrl)
          if (!this.completed[details.merkle]) {
            this.completed[details.merkle] = [ip]
          } else {
            this.completed[details.merkle].push(ip)
          }
          return results
        }
      } catch {
      }
    }
    console.log('Ran out of providers to upload to')
    return {
      merkle: hexToBuffer(details.merkle),
      owner: this.jklAddress,
      start: details.uploadHeight,
      cid: '',
    }
  }

  private async hostQueue () {
    while (true) {
      if (this.runQueue && this.queue.length > 0) {
        const details = this.queue.shift() as IUploadDetails
        await this.attempt(details)
      }
      await setDelay(.1)
    }
  }

  /**
   *
   * @param {string} pollUrl
   * @returns {Promise<IProviderUploadResponse>}
   * @private
   */
  private pollForCompletion (pollUrl: string): Promise<IProviderUploadResponse> {
    return new Promise(async (resolve, reject) => {
      try {
        let counter = 0
        let resp: IProviderStatusResponse = await fetch(pollUrl)
          .then(res => res.json())
        console.log('progress:', resp.progress, resp)

        while (resp.progress < 100) {
          counter++
          if (counter > 30) {
            reject(new Error('Polling timeout after 30 attempts'))
            return
          }
          await setDelay(30)
          resp = await fetch(pollUrl)
            .then(res => res.json())
          console.log('progress:', resp.progress, resp)
        }

        resolve({
          cid: resp.cid,
          merkle: resp.merkle,
          start: resp.start,
          owner: resp.owner,
        })
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   *
   * @param {string} url
   * @param {IUploadDetails} details
   * @returns {Promise<TMergedProviderResponse>}
   * @private
   */
  private async uploadFile (
    url: string,
    details: IUploadDetails,
  ): Promise<TMergedProviderResponse> {
    try {
      const { file, merkle, uploadHeight } = details
      const fileFormData = new FormData()
      fileFormData.set('file', file)
      fileFormData.set('merkle', merkle)
      fileFormData.set('sender', this.jklAddress)
      fileFormData.set('start', uploadHeight.toString())

      console.log('startBlock:', uploadHeight.toString(), url)
      return await fetch(url, {
        method: 'POST',
        body: fileFormData,
      }).then(
        async (resp): Promise<TMergedProviderResponse> => {
          if (typeof resp === 'undefined' || resp === null) {
            throw new Error(`Status Message: Empty Response`)
          }
          if (resp.status === 202) {
            return resp.json()
          } else if (resp.status === 200) {
            return resp.json()
          } else {
            try {
              const parsed = await resp.json()
              throw new Error(`Status Message: ${resp.status} ${resp.statusText} ${parsed.error}`)
            } catch (error) {
              const parsed = await resp.text()
              throw new Error(`Status Message: ${resp.status} ${parsed}`)
            }
          }
        },
      )
    } catch (err) {
      throw warnError('UploadHandler uploadFile()', err)
    }
  }
}