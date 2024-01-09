import {
  Action,
  ActionPanel,
  List,
  Icon,
  getPreferenceValues,
  LocalStorage,
} from '@raycast/api';
import { useEffect, useRef, useState } from 'react';
import { getFinderSelectedImages } from './utils/get-finder-selected-images';
import ImageKit from 'imagekit';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import imageType from 'image-type';

interface Preferences {
  publicKey: string;
  privateKey: string;
  urlEndpoint: string;
}

type ImageMeta = {
  source: string;
  format: string;
  url: string;
  size: number;
  height: number;
  width: number;
  thumbnailUrl: string;
};

const getType = async (filepath: string, data: Buffer) => {
  const type = await imageType(data);
  return type ? '.' + type.ext : path.extname(filepath);
};

export default function Command() {
  const [images, setImages] = useState<ImageMeta[]>();
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
      await LocalStorage.clear();
      const selectedImages = await getFinderSelectedImages();
      const uploadedImages = await Promise.all(
        selectedImages.map(async (image) => {
          const data = await fs.readFile(image);
          const type = await getType(image, data);
          const hash = crypto
            .createHash('sha256')
            .update(data)
            .digest('base64url');

          const record = await LocalStorage.getItem<string>(hash);

          if (record) {
            return JSON.parse(record);
          }

          const res = await imagekit.upload({
            file: data,
            fileName: `${hash}${type}`,
            useUniqueFileName: false,
          });

          const { url, size, height, width, thumbnailUrl } = res;

          console.log(res);

          const newRecord = {
            source: image,
            format: type,
            url,
            size,
            height,
            width,
            thumbnailUrl,
          };

          await LocalStorage.setItem(hash, JSON.stringify(newRecord));

          return newRecord;
        }),
      );
      console.log('uploadedImages', uploadedImages);
      setImages(uploadedImages);
    };
    load();
  }, []);

  console.log('images', images);

  return (
    <List isLoading={images === undefined}>
      {images?.length ? (
        images.map(({ url }) => (
          <List.Item
            title={url}
            accessories={[{ icon: Icon.CheckCircle }]}
            key={url}
            subtitle="local"
            actions={
              <ActionPanel>
                <Action.CopyToClipboard
                  icon={Icon.CopyClipboard}
                  content={url}
                />
              </ActionPanel>
            }
          />
        ))
      ) : (
        <List.EmptyView
          title={images === undefined ? 'Uploading...' : 'No images selected'}
        />
      )}
    </List>
  );
}
