import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Center,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  useDisclosure,
} from "@chakra-ui/react";
import { LogViewer, LogViewerSearch } from "@patternfly/react-log-viewer";
import { useQuery } from "@tanstack/react-query";

import { formatDate } from "@/utils/format";
import { streamFetch } from "@/utils/streamFetch";

import "./index.scss";

import { PodControllerGet } from "@/apis/v1/apps";
import useCustomSettingStore from "@/pages/customSetting";
import useGlobalStore from "@/pages/globalStore";

export default function LogsModal(props: { children: React.ReactElement }) {
  const { children } = props;
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();
  const settingStore = useCustomSettingStore();

  const { currentApp } = useGlobalStore((state) => state);

  const [logs, setLogs] = useState("");
  const [podName, setPodName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const { data: podData } = useQuery(
    ["GetPodQuery"],
    () => {
      return PodControllerGet({});
    },
    {
      onSuccess: (data) => {
        setPodName(data.data.pods[0]);
      },
      enabled: !!isOpen,
    },
  );

  const fetchLogs = useCallback(() => {
    if (!podName) return;
    const controller = new AbortController();
    streamFetch({
      url: `/v1/apps/${currentApp.appid}/logs/${podName}`,
      abortSignal: controller,
      firstResponse() {
        setIsLoading(false);
      },
      onMessage(text) {
        const regex = /id:\s\d+\s+data:\s(.*)\s+data:/g;
        const logs = [...text.matchAll(regex)];
        const regexTime = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/g;

        const logStr = logs
          .map((log) =>
            log[1].replace(regexTime, (str) => formatDate(str, "YYYY-MM-DD HH:mm:ss.SSS")),
          )
          .join("\n");

        setLogs((pre) => pre + logStr + "\n");
      },
    });
    return controller;
  }, [podName, currentApp.appid]);

  useEffect(() => {
    if (!isOpen) return;
    setLogs("");
    setIsLoading(true);
    const controller = fetchLogs();
    return () => {
      controller?.abort();
    };
  }, [podName, isOpen, fetchLogs]);

  return (
    <>
      {React.cloneElement(children, {
        onClick: () => {
          onOpen();
        },
      })}
      <Modal isOpen={isOpen} onClose={onClose} size={"6xl"}>
        <ModalOverlay />
        <ModalContent className="h-[90vh]" m={"auto"}>
          <ModalHeader>
            <ModalCloseButton />
            <HStack>
              <span>{t("Logs.PodLogs")}</span>
              <span>
                <Select
                  className="ml-4 !h-8 !w-64"
                  onChange={(e) => {
                    setPodName(e.target.value);
                    setIsLoading(true);
                    setLogs("");
                  }}
                >
                  {podData?.data?.pods &&
                    podData?.data?.pods.map((item: string) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </Select>
              </span>
              <span>
                <Button
                  variant={"outline"}
                  onClick={() => {
                    setIsLoading(true);
                    setLogs("");
                    fetchLogs();
                  }}
                >
                  {t("Refresh")}
                </Button>
              </span>
            </HStack>
          </ModalHeader>
          <ModalBody pr={0} py={0}>
            {isLoading ? (
              <Center className="h-full w-full">
                <Spinner />
              </Center>
            ) : (
              <div
                id="log-viewer-container"
                className="text-sm relative flex flex-col overflow-y-auto px-2 font-mono"
                style={{ height: "98%", fontSize: settingStore.commonSettings.fontSize - 1 }}
              >
                <LogViewer
                  data={logs}
                  hasLineNumbers={false}
                  scrollToRow={100000}
                  height={"100%"}
                  toolbar={
                    <div className="absolute right-16 top-4 z-10">
                      <LogViewerSearch
                        placeholder="Search"
                        minSearchChars={1}
                        className="mr-4 h-8 rounded-lg border pl-4 !text-grayModern-400"
                      />
                    </div>
                  }
                />
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
