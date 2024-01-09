import {
  Action,
  ActionPanel,
  Icon,
  List,
  LocalStorage,
  showHUD,
  showToast,
} from '@raycast/api';
import { useCallback, useEffect, useState } from 'react';
import { ImageMeta } from './common/types';
import path from 'path';
import { ImageDetailMetadata } from './common/components/image-detail-metadata';
import { useImageKit } from './common/hooks/useImageKit';
import { getDetailImage } from './common/utils/imagekit';

export default function ViewHistoryCommand() {
  const [images, setImages] = useState<ImageMeta[] | null>(null);
  useEffect(() => {
    const load = async () => {
      const images = await LocalStorage.allItems();
      setImages(
        Array.from(Object.values(images))
          .map((image) => JSON.parse(image))
          .sort((a, b) => b.createdAt - a.createdAt),
      );
    };

    load();
  }, []);

  const imagekit = useImageKit();

  const deleteImage = useCallback(async (image: ImageMeta) => {
    showToast({ title: 'Deleting...' });
    const result = await imagekit.deleteFile(image.fileId);
    if (result.$ResponseMetadata.statusCode !== 204) {
      showHUD('Failed to delete image');
      return;
    }
    await LocalStorage.removeItem(image.hash);
    showHUD('Image deleted successfully');
  }, []);

  return (
    <List isShowingDetail={!!images?.length}>
      {images ? (
        images.map((image) => {
          const imageFileName = path.basename(image.source);
          return (
            <List.Item
              key={image.hash}
              title={imageFileName}
              icon={
                image.from === 'clipboard'
                  ? 'SolarClipboardOutline.svg'
                  : 'SolarFileTextLinear.svg'
              }
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard
                    icon={Icon.CopyClipboard}
                    title="Copy Image CDN URL to Clipboard"
                    content={image.url}
                  />
                  <Action.OpenInBrowser url={image.url} />
                  <Action
                    title="Delete Image"
                    shortcut={{
                      modifiers: ['cmd'],
                      key: 'backspace',
                    }}
                    icon={Icon.DeleteDocument}
                    onAction={() => deleteImage(image)}
                  />
                </ActionPanel>
              }
              detail={
                <List.Item.Detail
                  markdown={`![${imageFileName}](${getDetailImage(
                    image.url,
                    180,
                  )})`}
                  metadata={<ImageDetailMetadata image={image} />}
                />
              }
            />
          );
        })
      ) : (
        <List.EmptyView />
      )}
    </List>
  );
}
