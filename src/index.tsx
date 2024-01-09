import {
  Action,
  ActionPanel,
  Icon,
  getPreferenceValues,
  LocalStorage,
  Detail,
} from '@raycast/api';
import { useEffect, useRef, useState } from 'react';
import { getFinderSelectedImages } from './utils/get-finder-selected-images';
import ImageKit from 'imagekit';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { imageMeta } from 'image-meta';

interface Preferences {
  publicKey: string;
  privateKey: string;
  urlEndpoint: string;
}

type ImageMeta = {
  source: string;
  format: string;
  url: string;
  thumbnailUrl: string;
  size: number;
  height?: number;
  width?: number;
};

type StateType =
  | {
      status: 'initial' | 'no-selected-image' | 'canceled';
    }
  | {
      status: 'succeed';
      cache: boolean;
      image: ImageMeta;
    };

const toUnit = (size: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let unitIndex = 0;
  let unit = units[unitIndex];
  while (size >= 1024) {
    size /= 1024;
    unitIndex++;
    unit = units[unitIndex];
  }
  return `${size.toFixed(2)} ${unit}`;
};

export default function Command() {
  const [state, setState] = useState<StateType>({
    status: 'initial',
  });

  const { publicKey, privateKey, urlEndpoint } =
    getPreferenceValues<Preferences>();

  const { current: imagekit } = useRef(
    new ImageKit({
      publicKey,
      privateKey,
      urlEndpoint,
    }),
  );

  useEffect(() => {
    const load = async () => {
      const selectedImages = await getFinderSelectedImages();
      if (!selectedImages?.length) {
        setState({
          status: 'no-selected-image',
        });
        return;
      }

      const image = selectedImages[0];
      const data = await fs.readFile(image);
      const meta = await imageMeta(data);
      const type = meta.type ?? path.extname(image).slice(1);
      const hash = crypto.createHash('sha256').update(data).digest('base64url');

      const record = await LocalStorage.getItem<string>(hash);

      if (record) {
        setState({
          status: 'succeed',
          cache: true,
          image: JSON.parse(record),
        });
        return;
      }

      const res = await imagekit.upload({
        file: data,
        fileName: `${hash}.${type}`,
        useUniqueFileName: false,
      });

      const {
        url,
        size = data.length,
        height = meta.height,
        width = meta.height,
        thumbnailUrl,
      } = res;

      const newRecord = {
        source: image,
        format: type,
        url,
        size,
        height,
        width,
        thumbnailUrl,
        createdAt: Date.now(),
      };

      await LocalStorage.setItem(hash, JSON.stringify(newRecord));

      setState({
        status: 'succeed',
        cache: false,
        image: newRecord,
      });
    };

    load();
  }, []);

  const MARKDOWN_TEXT =
    state.status === 'succeed'
      ? `
![Image Title](${state.image.url})
`
      : state.status === 'initial'
        ? '**uploading...**'
        : 'No Image Selected';

  return (
    <Detail
      markdown={MARKDOWN_TEXT}
      navigationTitle={
        state.status === 'initial' ? 'Uploading' : 'Uploaded successfully'
      }
      isLoading={state.status === 'initial'}
      metadata={
        state.status === 'succeed' ? (
          <Detail.Metadata>
            <Detail.Metadata.Link
              title="URL"
              target={state.image.url}
              text={state.image.url}
            />
            <Detail.Metadata.Separator />
            {state.image.format && (
              <Detail.Metadata.Label
                title="Format"
                text={
                  state.image.format.startsWith('.')
                    ? state.image.format.slice(1)
                    : state.image.format
                }
              />
            )}
            {state.image.size && (
              <Detail.Metadata.Label
                title="Size"
                text={toUnit(state.image.size)}
              />
            )}
            {state.image.width && (
              <Detail.Metadata.Label
                title="Width"
                text={String(state.image.width)}
              />
            )}
            {state.image.height && (
              <Detail.Metadata.Label
                title="Height"
                text={String(state.image.height)}
              />
            )}
          </Detail.Metadata>
        ) : null
      }
      actions={
        state.status === 'succeed' ? (
          <ActionPanel>
            <Action.CopyToClipboard
              icon={Icon.CopyClipboard}
              title="Copy Image CDN URL to Clipboard"
              content={state.image.url}
            />
            <Action.OpenInBrowser url={state.image.url} />
          </ActionPanel>
        ) : null
      }
    />
  );
}
