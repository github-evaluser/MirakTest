import React, { useEffect, useRef, useState } from "react"
import { toast } from "react-toastify"
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil"
import {
  mainPlayerLastSelectedServiceId,
  mainPlayerSelectedService,
  mainPlayerUrl,
} from "../../atoms/mainPlayer"
import {
  mirakurunCompatibility,
  mirakurunPrograms,
  mirakurunServices,
  mirakurunVersion,
} from "../../atoms/mirakurun"
import { mirakurunSetting } from "../../atoms/settings"
import { MirakurunAPI } from "../../infra/mirakurun"
import {
  Service,
  ServicesApiAxiosParamCreator,
} from "../../infra/mirakurun/api"

export const MirakurunManager: React.VFC<{}> = () => {
  const mirakurunSettingValue = useRecoilValue(mirakurunSetting)
  const setCompatibility = useSetRecoilState(mirakurunCompatibility)
  const setVersion = useSetRecoilState(mirakurunVersion)
  const setServices = useSetRecoilState(mirakurunServices)
  const setPrograms = useSetRecoilState(mirakurunPrograms)
  const [selectedService, setSelectedService] = useRecoilState(
    mainPlayerSelectedService
  )
  const setUrl = useSetRecoilState(mainPlayerUrl)
  const [lastSelectedServiceId, setLastSelectedServiceId] = useRecoilState(
    mainPlayerLastSelectedServiceId
  )

  const programUpdateTimer = useRef<NodeJS.Timeout | null>(null)

  const updatePrograms = async (mirakurun: MirakurunAPI) => {
    try {
      const programs = await mirakurun.programs.getPrograms()
      setPrograms(programs.data)
      console.log(`番組情報を更新しました。件数:`, programs.data.length)
    } catch (error) {
      console.error(error)
      toast.error("番組情報の取得に失敗しました")
      return
    }
  }

  const [isFirstAppeal, setIsFirstAppeal] = useState(true)

  const init = async (mirakurun: MirakurunAPI) => {
    try {
      const version = await mirakurun.version.checkVersion()
      let message: string
      if (typeof version.data === "string") {
        setCompatibility("Mirakc")
        setVersion(version.data)
        message = `Mirakc (${version.data})`
      } else {
        setCompatibility("Mirakurun")
        setVersion(version.data.current || null)
        message = `Mirakurun (${version.data.current})`
      }
      if (!isFirstAppeal) {
        toast.info(message)
      }
      setIsFirstAppeal(false)
    } catch (error) {
      console.error(error)
      toast.error("Mirakurun への接続に失敗しました")
      return
    }
    let services: Service[]
    try {
      const servicesReq = await mirakurun.services.getServices()
      setServices(servicesReq.data)
      services = servicesReq.data
    } catch (error) {
      console.error(error)
      toast.error("サービス情報の取得に失敗しました")
      return
    }
    await updatePrograms(mirakurun)
    if (programUpdateTimer.current) {
      clearInterval(programUpdateTimer.current)
    }
    programUpdateTimer.current = setInterval(
      () => updatePrograms(mirakurun),
      1000 * 60 * 60
    )
    if (lastSelectedServiceId) {
      const service = services.find(
        (service) => service.id === lastSelectedServiceId
      )
      if (service) {
        setSelectedService(service)
        return
      }
    }
    if (0 < services.length) {
      setSelectedService(services[0])
    }
  }
  useEffect(() => {
    if (mirakurunSettingValue.baseUrl) {
      try {
        const mirakurun = new MirakurunAPI(mirakurunSettingValue)
        init(mirakurun)
      } catch (error) {
        console.error(error)
      }
    } else {
      toast.info(
        "Mirakurun の設定が行われていません。設定画面から設定を行ってください。",
        { autoClose: false }
      )
      setIsFirstAppeal(false)
    }
    return () => {
      if (programUpdateTimer.current) {
        clearInterval(programUpdateTimer.current)
        programUpdateTimer.current = null
      }
    }
  }, [mirakurunSettingValue])

  const updateToSelectedService = async (selectedService: Service) => {
    const mirakurun = new MirakurunAPI(mirakurunSettingValue)
    const req = await ServicesApiAxiosParamCreator(
      mirakurun.getConfigure()
    ).getServiceStream(selectedService.id)
    let url = mirakurunSettingValue.baseUrl + req.url
    if (mirakurunSettingValue.username || mirakurunSettingValue.password) {
      const auth = [
        mirakurunSettingValue.username,
        mirakurunSettingValue.password,
      ]
        .filter((s) => s)
        .join(":")
      url = url.replace("//", `//${auth}@`)
    }
    setUrl(url)
    setLastSelectedServiceId(selectedService.id)
  }

  useEffect(() => {
    if (!selectedService) return
    console.log(`表示サービスを変更します:`, selectedService)
    try {
      updateToSelectedService(selectedService)
    } catch (error) {
      console.error(error)
    } finally {
    }
  }, [selectedService])
  return <></>
}