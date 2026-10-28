"""Remove the audio file from disk when a submission (or the student's account) is deleted."""
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import SpeakingSubmission


@receiver(post_delete, sender=SpeakingSubmission)
def delete_audio_file(sender, instance, **kwargs):
    if instance.audio:
        instance.audio.delete(save=False)
